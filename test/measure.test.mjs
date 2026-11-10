import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_IGNORE_PATTERNS } from '../src/config.mjs';
import { measure, verdict } from '../src/measure.mjs';

const opts = {
  ignore: DEFAULT_IGNORE_PATTERNS.map((p) => new RegExp(p)),
  componentIgnore: [/^\.release-please-manifest\.json$/],
  components: [
    ['api', 'apps/api/'],
    ['web', 'apps/web/'],
    ['web', 'packages/ui/'],
  ],
  deletionWeight: 0.5,
  unmatchedComponent: 'repo',
};
const f = (filename, additions = 0, deletions = 0) => ({ filename, additions, deletions });
const thresholds = {
  big: { lines: 1500, files: 50, components: 3 },
  absurd: { lines: 4000, files: 150, components: 5 },
  bigRequired: 2,
};

test('measure weights deletions and skips ignored files', () => {
  const m = measure(
    [
      f('apps/api/a.cs', 100, 51),
      f('apps/web/package-lock.json', 5000, 5000),
      f('apps/web/x.snap', 9, 0),
    ],
    opts,
  );
  assert.deepEqual(m, {
    additions: 100,
    deletions: 51,
    lines: 126,
    files: 1,
    ignoredFiles: 2,
    components: ['api'],
  });
});

test('measure maps files to components, first prefix wins, the rest is unmatched', () => {
  const m = measure(
    [f('apps/api/a'), f('packages/ui/b'), f('README.md'), f('.release-please-manifest.json', 3, 3)],
    opts,
  );
  assert.deepEqual(m.components, ['api', 'repo', 'web']);
  assert.equal(m.files, 4);
});

test('a component-ignored file alone drags no component in', () => {
  assert.deepEqual(measure([f('.release-please-manifest.json', 1)], opts).components, []);
});

test('unmatchedComponent null leaves unmatched files out of the component count', () => {
  const m = measure([f('README.md', 1)], { ...opts, unmatchedComponent: null });
  assert.deepEqual(m.components, []);
  assert.equal(m.files, 1);
});

const metrics = (lines, files, n) => ({
  lines,
  files,
  components: Array.from({ length: n }, (_, i) => `c${i}`),
});

test('verdict: two big thresholds make a PR giant, one does not', () => {
  assert.equal(verdict(metrics(1500, 50, 1), thresholds).giant, true);
  assert.equal(verdict(metrics(1500, 49, 2), thresholds).giant, false);
  assert.equal(verdict(metrics(10, 50, 3), thresholds).giant, true);
});

test('verdict: one absurd threshold is enough', () => {
  const v = verdict(metrics(4000, 1, 1), thresholds);
  assert.equal(v.giant, true);
  assert.equal(v.absurdHit, true);
  assert.equal(v.bigCount, 1);
});

test('verdict: a threshold of 0 is disabled', () => {
  const off = { ...thresholds, absurd: { lines: 0, files: 0, components: 0 } };
  assert.equal(verdict(metrics(0, 0, 0), off).giant, false);
  assert.equal(verdict(metrics(99999, 0, 0), off).giant, false);
});
