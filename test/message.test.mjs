import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BONUSES, CLOSERS, OPENERS, ROASTS, bonus, message, roasts } from '../src/message.mjs';

const pr = {
  number: 42,
  title: 'Rewrite <everything> & more',
  html_url: 'https://gh/pr/42',
  user: { login: 'octo' },
};
const metrics = {
  additions: 3000,
  deletions: 200,
  lines: 3100,
  files: 60,
  ignoredFiles: 2,
  components: ['api', 'web'],
};
const verdict = {
  big: { lines: true, files: true, components: false },
  absurd: { lines: false, files: false, components: false },
};
const everything = {
  big: { lines: true, files: true, components: true },
  absurd: { lines: true, files: true, components: true },
};

test('message mentions the Slack user and strips mrkdwn control characters', () => {
  const text = message({ pr, slackUserId: 'U1', metrics, verdict, random: () => 0 });
  const lines = text.split('\n');
  assert.equal(lines[0], OPENERS[0]('<@U1>', '<https://gh/pr/42|#42 Rewrite everything  more>'));
  assert.equal(lines[1], '• This diff runs 3,100 weighted lines, which is roughly novella length.');
  assert.equal(lines[2], '• 60 files. The "Files changed" tab needs a lie down.');
  // 3,000 added vs 200 deleted: the "more than ten to one" bonus applies.
  assert.match(lines[3], /^• For every line removed, more than ten were added\./);
  assert.equal(
    lines[4],
    '_+3,000 / -200 · 60 files (+2 lock/generated, not counted) · components: api, web_',
  );
  assert.equal(lines[5], CLOSERS[0]);
});

test('message names the GitHub login when no Slack user was found', () => {
  const text = message({ pr, slackUserId: null, metrics, verdict, random: () => 0.999 });
  assert.match(text, /\*octo\*/);
  assert.ok(text.endsWith(CLOSERS.at(-1)));
});

test('roasts escalate on absurd thresholds', () => {
  assert.equal(roasts(metrics, everything).length, 6);
});

test('the pools are big enough to vary, with no duplicates', () => {
  const pools = {
    openers: OPENERS.map((o) => o('WHO', 'LINK')),
    closers: CLOSERS,
    ...Object.fromEntries(
      Object.entries(ROASTS).flatMap(([tier, byMetric]) =>
        Object.entries(byMetric).map(([metric, list]) => [
          `${tier}.${metric}`,
          list.map((r) => r(metrics)),
        ]),
      ),
    ),
  };
  assert.ok(pools.openers.length >= 25, 'openers');
  assert.ok(pools.closers.length >= 25, 'closers');
  for (const [name, list] of Object.entries(pools)) {
    assert.ok(list.length >= 5, `${name} has at least 5 entries`);
    assert.equal(new Set(list).size, list.length, `${name} has no duplicates`);
  }
});

test('every opener names the author and links the PR exactly once', () => {
  for (const opener of OPENERS) {
    const text = opener('WHO', 'LINK');
    assert.equal(text.split('WHO').length - 1, 1, text);
    assert.equal(text.split('LINK').length - 1, 1, text);
  }
});

test('every possible message renders cleanly', () => {
  // Walk each pool position by driving `random` through every index.
  const shapes = [
    metrics,
    { ...metrics, additions: 10, deletions: 5000, ignoredFiles: 4 },
    { ...metrics, deletions: 0 },
    { ...metrics, lines: 500_000, components: [] },
  ];
  for (const m of shapes) {
    for (let i = 0; i < 40; i++) {
      const text = message({
        pr,
        slackUserId: 'U1',
        metrics: m,
        verdict: everything,
        random: () => i / 40,
      });
      assert.doesNotMatch(text, /undefined|NaN|\[object|function/, text);
    }
  }
});

test('bonus lines pick the shape of the PR, or nothing', () => {
  assert.match(bonus({ ...metrics, additions: 10, deletions: 5000 }), /deletions/i);
  assert.match(bonus({ ...metrics, deletions: 0 }), /deletions|removed/i);
  assert.equal(bonus({ ...metrics, additions: 1000, deletions: 800, ignoredFiles: 0 }), null);
  assert.ok(BONUSES.every((b) => b.lines.length >= 1));
});
