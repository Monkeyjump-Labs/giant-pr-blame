import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_IGNORE_PATTERNS,
  inputReader,
  lines,
  parseComponents,
  readConfig,
} from '../src/config.mjs';
import { inputs } from './helpers.mjs';

const base = {
  'github-token': 't',
  'pr-number': '7',
  'slack-bot-token': 'x',
  'slack-channel': 'C1',
};
const env = { GITHUB_REPOSITORY: 'o/r' };

test('inputReader reads INPUT_ variables the way the runner sets them', () => {
  const input = inputReader({ 'INPUT_PR-NUMBER': ' 12 ', 'INPUT_SLACK-BOT-TOKEN': 'x' });
  assert.equal(input('pr-number'), '12');
  assert.equal(input('slack-bot-token'), 'x');
  assert.equal(input('missing'), '');
});

test('lines drops blanks, comments and list dashes', () => {
  assert.deepEqual(lines('a\n\n  # note\n- b\r\n  c  '), ['a', 'b', 'c']);
});

test('parseComponents reads name: prefix pairs', () => {
  assert.deepEqual(parseComponents('api: apps/api/\n- web: apps/web/'), [
    ['api', 'apps/api/'],
    ['web', 'apps/web/'],
  ]);
  assert.throws(() => parseComponents('apps/api/'), /expected "name: path/);
  assert.throws(() => parseComponents('api:'), /expected "name: path/);
});

test('readConfig applies the defaults', () => {
  const c = readConfig(inputs(base), env);
  assert.equal(c.repo, 'o/r');
  assert.equal(c.prNumber, 7);
  assert.equal(c.label, 'giant-pr');
  assert.equal(c.dryRun, false);
  assert.deepEqual(c.thresholds, {
    big: { lines: 1500, files: 50, components: 3 },
    absurd: { lines: 4000, files: 150, components: 5 },
    bigRequired: 2,
  });
  assert.equal(c.deletionWeight, 0.5);
  assert.equal(c.ignore.length, DEFAULT_IGNORE_PATTERNS.length);
  assert.equal(c.unmatchedComponent, 'repo');
});

test('readConfig reads overrides', () => {
  const c = readConfig(
    inputs({
      ...base,
      label: 'huge',
      'big-lines': '10',
      'absurd-files': '0',
      'big-required': '1',
      'deletion-weight': '0',
      'ignore-patterns': '^gen/',
      'use-default-ignore-patterns': 'false',
      'unmatched-component': 'none',
      components: 'api: api/',
      'component-ignore-patterns': '^manifest\\.json$',
    }),
    env,
  );
  assert.equal(c.label, 'huge');
  assert.equal(c.thresholds.big.lines, 10);
  assert.equal(c.thresholds.absurd.files, 0);
  assert.equal(c.thresholds.bigRequired, 1);
  assert.equal(c.deletionWeight, 0);
  assert.deepEqual(c.ignore.map(String), ['/^gen\\//']);
  assert.equal(c.unmatchedComponent, null);
  assert.deepEqual(c.components, [['api', 'api/']]);
  assert.equal(c.componentIgnore.length, 1);
});

test('readConfig rejects bad input', () => {
  assert.throws(() => readConfig(inputs({ ...base, 'pr-number': '' }), env), /pr-number/);
  assert.throws(() => readConfig(inputs({ ...base, 'big-lines': 'lots' }), env), /big-lines/);
  assert.throws(() => readConfig(inputs({ ...base, 'dry-run': 'yes' }), env), /dry-run/);
  assert.throws(
    () => readConfig(inputs({ ...base, 'ignore-patterns': '(' }), env),
    /invalid regular/,
  );
  assert.throws(() => readConfig(inputs(base), {}), /repository/);
});

test('Slack settings are required unless dry-run', () => {
  const noSlack = { 'github-token': 't', 'pr-number': '7' };
  assert.throws(() => readConfig(inputs(noSlack), env), /slack-bot-token and slack-channel/);
  const c = readConfig(inputs({ ...noSlack, 'dry-run': 'true' }), env);
  assert.equal(c.dryRun, true);
  assert.equal(c.slackToken, null);
});
