import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOSERS, OPENERS, message, roasts } from '../src/message.mjs';

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

test('message mentions the Slack user and strips mrkdwn control characters', () => {
  const text = message({ pr, slackUserId: 'U1', metrics, verdict, random: () => 0 });
  const lines = text.split('\n');
  assert.equal(lines[0], OPENERS[0]('<@U1>', '<https://gh/pr/42|#42 Rewrite everything  more>'));
  assert.equal(lines[1], '• 3,100 weighted lines. That is not a diff, that is a novella.');
  assert.equal(lines[2], '• 60 files. The "Files changed" tab needs a lie down.');
  assert.equal(
    lines[3],
    '_+3,000 / -200 · 60 files (+2 lock/generated, not counted) · components: api, web_',
  );
  assert.equal(lines[4], CLOSERS[0]);
});

test('message names the GitHub login when no Slack user was found', () => {
  const text = message({ pr, slackUserId: null, metrics, verdict, random: () => 0.999 });
  assert.match(text, /\*octo\*/);
  assert.ok(text.endsWith(CLOSERS.at(-1)));
});

test('roasts escalate on absurd thresholds', () => {
  const all = {
    big: { lines: true, files: true, components: true },
    absurd: { lines: true, files: true, components: true },
  };
  assert.equal(roasts(metrics, all).length, 6);
});
