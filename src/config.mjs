// Turns the action inputs into one config object. Every default lives here, so the
// action, the tests and a local run all agree on them.

// Files that are big for free and that nobody reads line by line. They count toward
// neither lines nor files.
export const DEFAULT_IGNORE_PATTERNS = [
  '(^|/)package-lock\\.json$',
  '(^|/)npm-shrinkwrap\\.json$',
  '(^|/)yarn\\.lock$',
  '(^|/)pnpm-lock\\.yaml$',
  '(^|/)bun\\.lockb?$',
  '(^|/)poetry\\.lock$',
  '(^|/)uv\\.lock$',
  '(^|/)Pipfile\\.lock$',
  '(^|/)Gemfile\\.lock$',
  '(^|/)composer\\.lock$',
  '(^|/)Cargo\\.lock$',
  '(^|/)go\\.sum$',
  '(^|/)packages\\.lock\\.json$',
  '\\.snap$',
  '(^|/)Migrations/.*\\.Designer\\.cs$',
  '(^|/)Migrations/.*ModelSnapshot\\.cs$',
  '\\.min\\.(js|css)$',
  '(^|/)CHANGELOG\\.md$',
];

export const DEFAULTS = {
  label: 'giant-pr',
  bigLines: 1500,
  bigFiles: 50,
  bigComponents: 3,
  absurdLines: 4000,
  absurdFiles: 150,
  absurdComponents: 5,
  bigRequired: 2,
  deletionWeight: 0.5,
  unmatchedComponent: 'repo',
};

// Reads an input the way the runner passes it: INPUT_<NAME>, upper-cased, spaces as `_`.
export const inputReader =
  (env = process.env) =>
  (name) =>
    (env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();

// One entry per non-empty line. A line starting with `#` is a comment, and a leading
// `- ` is dropped so a YAML-looking list also works.
export const lines = (text) =>
  (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^-\s+/, ''))
    .filter((l) => l && !l.startsWith('#'));

// "web: apps/web/" -> ['web', 'apps/web/']. The same name may appear on several lines.
export function parseComponents(text) {
  return lines(text).map((line) => {
    const i = line.indexOf(':');
    const name = line.slice(0, i).trim();
    const prefix = line.slice(i + 1).trim();
    if (i < 0 || !name || !prefix) {
      throw new Error(`components: expected "name: path/prefix/", got "${line}"`);
    }
    return [name, prefix];
  });
}

function regexes(name, patterns) {
  return patterns.map((p) => {
    try {
      return new RegExp(p);
    } catch (err) {
      throw new Error(`${name}: invalid regular expression "${p}": ${err.message}`, {
        cause: err,
      });
    }
  });
}

function number(input, name, fallback) {
  const raw = input(name);
  if (raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  }
  return n;
}

function bool(input, name, fallback) {
  const raw = input(name).toLowerCase();
  if (raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be "true" or "false", got "${raw}"`);
}

export function readConfig(input, env = process.env) {
  const repo = input('repository') || env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('repository is not set and GITHUB_REPOSITORY is empty');

  const prRaw = input('pr-number');
  const prNumber = Number(prRaw);
  if (!prRaw || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(
      `pr-number must be a pull request number, got "${prRaw}". Run on a pull_request ` +
        'event or pass pr-number explicitly.',
    );
  }

  const githubToken = input('github-token');
  if (!githubToken) throw new Error('github-token is required');

  const dryRun = bool(input, 'dry-run', false);
  const slackToken = input('slack-bot-token');
  const slackChannel = input('slack-channel');
  if (!dryRun && (!slackToken || !slackChannel)) {
    throw new Error('slack-bot-token and slack-channel are required unless dry-run is true');
  }

  const ignore = [
    ...(bool(input, 'use-default-ignore-patterns', true) ? DEFAULT_IGNORE_PATTERNS : []),
    ...lines(input('ignore-patterns')),
  ];

  const unmatched = input('unmatched-component') || DEFAULTS.unmatchedComponent;
  return {
    repo,
    prNumber,
    githubToken,
    slackToken: slackToken || null,
    slackChannel: slackChannel || null,
    dryRun,
    label: input('label') || DEFAULTS.label,
    thresholds: {
      big: {
        lines: number(input, 'big-lines', DEFAULTS.bigLines),
        files: number(input, 'big-files', DEFAULTS.bigFiles),
        components: number(input, 'big-components', DEFAULTS.bigComponents),
      },
      absurd: {
        lines: number(input, 'absurd-lines', DEFAULTS.absurdLines),
        files: number(input, 'absurd-files', DEFAULTS.absurdFiles),
        components: number(input, 'absurd-components', DEFAULTS.absurdComponents),
      },
      bigRequired: number(input, 'big-required', DEFAULTS.bigRequired),
    },
    deletionWeight: number(input, 'deletion-weight', DEFAULTS.deletionWeight),
    ignore: regexes('ignore-patterns', ignore),
    componentIgnore: regexes(
      'component-ignore-patterns',
      lines(input('component-ignore-patterns')),
    ),
    components: parseComponents(input('components')),
    // `none` means files outside every component do not count as a component at all.
    unmatchedComponent: unmatched.toLowerCase() === 'none' ? null : unmatched,
  };
}
