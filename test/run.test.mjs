import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSlackUser } from '../src/author.mjs';
import { createGitHub, createSlack } from '../src/clients.mjs';
import { DEFAULT_IGNORE_PATTERNS } from '../src/config.mjs';
import { outputs, summary } from '../src/report.mjs';
import { run } from '../src/run.mjs';
import { fakeFetch, silentLog } from './helpers.mjs';

const config = {
  repo: 'o/r',
  prNumber: 7,
  label: 'giant-pr',
  dryRun: false,
  slackChannel: 'C1',
  thresholds: {
    big: { lines: 1500, files: 50, components: 3 },
    absurd: { lines: 4000, files: 150, components: 5 },
    bigRequired: 2,
  },
  deletionWeight: 0.5,
  ignore: DEFAULT_IGNORE_PATTERNS.map((p) => new RegExp(p)),
  componentIgnore: [],
  components: [],
  unmatchedComponent: 'repo',
};

const pr = (extra = {}) => ({
  number: 7,
  title: 'Big one',
  html_url: 'https://github.com/o/r/pull/7',
  draft: false,
  labels: [],
  user: { login: 'octo' },
  ...extra,
});

// 120 files of 20 lines: giant by files (absurd is 150, big is 50) and lines (2400 >= 1500).
const files = Array.from({ length: 120 }, (_, i) => ({
  filename: `src/f${i}.js`,
  additions: 20,
  deletions: 0,
}));

function setup({ prBody = pr(), fileList = files, slackRoutes = {}, githubRoutes = {} } = {}) {
  const net = fakeFetch({
    'GET ^/repos/o/r/pulls/7$': () => prBody,
    'GET ^/repos/o/r/pulls/7/files\\?per_page=100&page=1$': () => fileList.slice(0, 100),
    'GET ^/repos/o/r/pulls/7/files\\?per_page=100&page=2$': () => fileList.slice(100, 200),
    'GET ^/users/octo$': () => ({ login: 'octo', name: 'Octo Cat', email: null }),
    'GET ^/repos/o/r/pulls/7/commits': () => [
      { author: { login: 'octo' }, commit: { author: { email: 'octo@example.com' } } },
      { author: { login: 'someone' }, commit: { author: { email: 'someone@example.com' } } },
    ],
    'GET ^/repos/o/r/commits\\?author=octo': () => [
      { commit: { author: { email: '1+octo@users.noreply.github.com' } } },
    ],
    'POST ^/repos/o/r/issues/7/labels$': () => [{ name: 'giant-pr' }],
    'DELETE ^/repos/o/r/issues/7/labels/giant-pr$': () => ({ status: 204 }),
    'GET ^/api/users.lookupByEmail': () => ({ ok: true, user: { id: 'U_OCTO', deleted: false } }),
    'POST ^/api/chat.postMessage$': () => ({ ok: true }),
    ...githubRoutes,
    ...slackRoutes,
  });
  const gh = createGitHub({ token: 'gh', apiUrl: 'https://api.github.test', fetch: net.fetch });
  const slack = createSlack({ token: 'sl', apiUrl: 'https://slack.test/api', fetch: net.fetch });
  return { net, gh, slack, log: silentLog() };
}

const called = (net, method, re) =>
  net.calls.filter((c) => c.method === method && re.test(c.target));

test('a giant PR is labeled, then posted with the author mentioned', async () => {
  const { net, gh, slack, log } = setup();
  const result = await run({ config, gh, slack, log, random: () => 0 });

  assert.equal(result.giant, true);
  assert.equal(result.posted, true);
  assert.equal(result.slackUserId, 'U_OCTO');
  assert.equal(result.metrics.files, 120);
  const label = net.calls.findIndex((c) => c.method === 'POST' && /labels$/.test(c.target));
  const post = net.calls.findIndex((c) => /chat\.postMessage/.test(c.target));
  assert.ok(label >= 0 && post > label, 'label before post');
  assert.deepEqual(net.calls[label].body, { labels: ['giant-pr'] });
  assert.equal(net.calls[post].body.channel, 'C1');
  assert.match(net.calls[post].body.text, /<@U_OCTO>/);
  // Only the author's own commit email is looked up, never another committer's or a noreply.
  const lookups = called(net, 'GET', /lookupByEmail/).map((c) => c.target);
  assert.deepEqual(lookups, ['/api/users.lookupByEmail?email=octo%40example.com']);
});

test('a small PR is measured and left alone', async () => {
  const { net, gh, slack, log } = setup({ fileList: files.slice(0, 3) });
  const result = await run({ config, gh, slack, log });
  assert.equal(result.giant, false);
  assert.equal(called(net, 'POST', /./).length, 0);
});

test('draft and already-labeled PRs are skipped before measuring', async () => {
  for (const [body, reason] of [
    [pr({ draft: true }), 'draft'],
    [pr({ labels: [{ name: 'giant-pr' }] }), 'labeled'],
  ]) {
    const { net, gh, slack, log } = setup({ prBody: body });
    const result = await run({ config, gh, slack, log });
    assert.equal(result.skipped, reason);
    assert.equal(called(net, 'GET', /files/).length, 0);
  }
});

test('dry-run builds the message but writes nothing', async () => {
  const { net, gh, slack, log } = setup();
  const result = await run({ config: { ...config, dryRun: true }, gh, slack, log });
  assert.equal(result.giant, true);
  assert.equal(result.posted, false);
  assert.ok(result.text);
  assert.equal(called(net, 'POST', /./).length, 0);
});

test('without a Slack token the GitHub login is named', async () => {
  const { gh, log } = setup();
  const result = await run({ config: { ...config, dryRun: true }, gh, slack: null, log });
  assert.equal(result.slackUserId, null);
  assert.match(result.text, /\*octo\*/);
});

test('a failed post removes the label again and fails the run', async () => {
  const { net, gh, slack, log } = setup({
    slackRoutes: { 'POST ^/api/chat.postMessage$': () => ({ ok: false, error: 'not_in_channel' }) },
  });
  await assert.rejects(run({ config, gh, slack, log }), /not_in_channel/);
  assert.equal(called(net, 'DELETE', /labels\/giant-pr$/).length, 1);
});

test('findSlackUser falls back to a single name match', async () => {
  const { gh, slack, log } = setup({
    slackRoutes: {
      'GET ^/api/users.lookupByEmail': () => ({ ok: false, error: 'users_not_found' }),
      'GET ^/api/users.list\\?limit=200$': () => ({
        ok: true,
        members: [
          { id: 'U_BOT', is_bot: true, real_name: 'Octo Cat' },
          { id: 'U_OTHER', real_name: 'Someone Else', profile: {} },
        ],
        response_metadata: { next_cursor: 'p2' },
      }),
      'GET ^/api/users.list\\?limit=200&cursor=p2$': () => ({
        ok: true,
        members: [{ id: 'U_OCTO', real_name: 'Octo Cat', profile: {} }],
      }),
    },
  });
  assert.equal(await findSlackUser({ gh, slack, repo: 'o/r', pr: pr(), log }), 'U_OCTO');
});

test('findSlackUser gives up on an ambiguous name', async () => {
  const { gh, slack, log } = setup({
    slackRoutes: {
      'GET ^/api/users.lookupByEmail': () => ({ ok: false, error: 'users_not_found' }),
      'GET ^/api/users.list': () => ({
        ok: true,
        members: [
          { id: 'U1', real_name: 'Octo Cat', profile: {} },
          { id: 'U2', name: 'octo', profile: {} },
        ],
      }),
    },
  });
  assert.equal(await findSlackUser({ gh, slack, repo: 'o/r', pr: pr(), log }), null);
  assert.ok(log.lines.some((l) => /2 name matches/.test(l)));
});

test('GitHub errors carry the method, path and status', async () => {
  const { gh, slack, log } = setup({
    githubRoutes: { 'GET ^/repos/o/r/pulls/7$': () => ({ status: 404, body: 'nope' }) },
  });
  await assert.rejects(run({ config, gh, slack, log }), /GitHub GET \/repos\/o\/r\/pulls\/7: 404/);
});

test('outputs and summary describe the result', async () => {
  const { gh, slack, log } = setup();
  const result = await run({ config, gh, slack, log });
  assert.deepEqual(outputs(result), {
    giant: 'true',
    posted: 'true',
    skipped: '',
    lines: '2400',
    files: '120',
    components: 'repo',
    'slack-user-id': 'U_OCTO',
  });
  const md = summary(config, result);
  assert.match(md, /Labeled and posted to Slack/);
  assert.match(md, /\| Files \| 120 \| 50 :warning: \| 150 \|/);
  assert.match(summary(config, { skipped: 'draft' }), /skipped \(draft\)/);
});
