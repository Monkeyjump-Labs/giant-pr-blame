# Giant PR Blame

[![CI](https://github.com/Monkeyjump-Labs/giant-pr-blame/actions/workflows/ci.yml/badge.svg)](https://github.com/Monkeyjump-Labs/giant-pr-blame/actions/workflows/ci.yml)

A GitHub Action that measures a pull request and, when it is truly giant, posts a public and
lightly accusatory message to Slack that @-mentions its author.

> :elephant: A wild giant PR appeared! @Pat summoned #812 Rewrite the billing service.
>
> - This diff runs 3,100 weighted lines, which is roughly novella length.
> - 4 components (api, billing, web, worker). Cross-component pollution detected.
>
> _+3,000 / -200 · 41 files (+2 lock/generated, not counted) · components: api, billing, web, worker_
>
> Could this have been a stack? (Rhetorical. Yes.)

A PR is posted once. The action adds a `giant-pr` label when it posts and skips any PR that
has it; remove the label to let the PR be judged again.

## When is a PR giant?

When it crosses two of the "big" thresholds, or any one "absurd" threshold:

| Metric                 | Big  | Absurd |
| ---------------------- | ---- | ------ |
| Weighted lines changed | 1500 | 4000   |
| Files changed          | 50   | 150    |
| Components touched     | 3    | 5      |

- **Weighted lines** count an addition as 1 and a deletion as 0.5: deleting code is good,
  but not free to review.
- **Ignored files** count toward nothing: lock files (npm, yarn, pnpm, bun, Poetry, uv,
  Pipenv, Bundler, Composer, Cargo, Go, NuGet), Jest snapshots, minified JS and CSS,
  `CHANGELOG.md`, and generated Entity Framework migration designer and snapshot files.
- **Components** are path prefixes you define. Without any, every file falls in one
  `repo` component, so that metric never trips.

Every number is an input, and a threshold of `0` turns it off.

## Usage

```yaml
# .github/workflows/giant-pr-blame.yml
name: Giant PR blame

on:
  pull_request:
    # synchronize too, so a PR that starts small and grows still gets caught.
    types: [opened, reopened, ready_for_review, synchronize]

# One run per PR at a time. A new push waits instead of cancelling, so a run never stops
# between the label and the Slack post; the waiting run then sees the label and skips.
concurrency:
  group: giant-pr-blame-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions: {}

jobs:
  blame:
    runs-on: ubuntu-latest
    # Skip forks (no secrets, read-only token) and bot PRs, which are big by design.
    if: >-
      github.event.pull_request.head.repo.full_name == github.repository &&
      !startsWith(github.head_ref, 'dependabot/') &&
      !startsWith(github.head_ref, 'release-please--')
    permissions:
      contents: read
      pull-requests: write # add the label (GitHub checks this one on a PR)
      issues: write # create the label the first time it is used
    steps:
      - uses: Monkeyjump-Labs/giant-pr-blame@v1
        with:
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel: C0123456789
          components: |
            api: apps/api/
            web: apps/web/
            web: packages/ui/
            infra: infra/
```

No checkout step is needed: the action reads the PR through the GitHub API.

Draft PRs are skipped; they are judged when they are marked ready for review.

### Slack setup

1. Create a Slack app and install it in your workspace with the bot token scopes
   `chat:write`, `users:read` and `users:read.email`.
2. Store its bot token (`xoxb-...`) as a repository or organization secret.
3. Invite the bot to the channel (`/invite @your-app`) and pass the channel ID, not its name.

### Finding the author on Slack

The author is the person who opened the PR, not the latest committer, so a reviewer who
pushes a fix does not inherit the shame. The action looks them up in two steps:

1. **By email.** The author's public GitHub email and the emails on their commits in this PR
   and in the repo history go to Slack `users.lookupByEmail`. GitHub noreply addresses are
   skipped.
2. **By name**, for authors who only commit with a noreply address. The GitHub name and login
   are matched against each Slack member's real name, display name, handle and email local
   part, ignoring case and punctuation. Only a single match counts, so a common name never
   tags the wrong person.

When neither finds exactly one person, the message names the GitHub login instead.

## Inputs

| Input                         | Default                | Description                                                                                         |
| ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `slack-bot-token`             |                        | Slack bot token. Required unless `dry-run`.                                                         |
| `slack-channel`               |                        | Slack channel ID. Required unless `dry-run`.                                                        |
| `github-token`                | `github.token`         | Reads the PR and adds the label.                                                                    |
| `pr-number`                   | the triggering PR      | The PR to judge.                                                                                    |
| `repository`                  | the current repository | `owner/name`.                                                                                       |
| `label`                       | `giant-pr`             | Added when the message is posted. A PR with it is never posted again.                               |
| `big-lines`                   | `1500`                 | Weighted lines that count as big.                                                                   |
| `big-files`                   | `50`                   | Files changed that count as big.                                                                    |
| `big-components`              | `3`                    | Components touched that count as big.                                                               |
| `big-required`                | `2`                    | How many big thresholds make a PR giant.                                                            |
| `absurd-lines`                | `4000`                 | Weighted lines that make a PR giant on their own.                                                   |
| `absurd-files`                | `150`                  | Files changed that make a PR giant on their own.                                                    |
| `absurd-components`           | `5`                    | Components touched that make a PR giant on their own.                                               |
| `deletion-weight`             | `0.5`                  | How much a deleted line counts.                                                                     |
| `components`                  |                        | Newline-separated `name: path/prefix/` pairs. First match wins; repeat a name for several prefixes. |
| `unmatched-component`         | `repo`                 | Component for files outside every prefix, or `none` to not count them.                              |
| `component-ignore-patterns`   |                        | Regexes for files that count toward lines and files but not components, such as a release manifest. |
| `ignore-patterns`             |                        | Regexes for more files that count toward nothing, added to the defaults.                            |
| `use-default-ignore-patterns` | `true`                 | Ignore the lock and generated files listed above.                                                   |
| `dry-run`                     | `false`                | Measure and print the message, but do not label or post.                                            |

## Outputs

| Output          | Description                                        |
| --------------- | -------------------------------------------------- |
| `giant`         | `true` when the PR is giant.                       |
| `posted`        | `true` when the message was posted.                |
| `skipped`       | `draft` or `labeled` when the PR was not judged.   |
| `lines`         | Weighted lines changed, excluding ignored files.   |
| `files`         | Files changed, excluding ignored files.            |
| `components`    | Comma-separated components touched.                |
| `slack-user-id` | Slack member ID of the author, when one was found. |

Every run also writes the measurements to the job summary.

## Versioning

Releases follow [semantic versioning](https://semver.org). Pin to a major tag such as `@v1` to
get fixes and features without breaking changes, or to a full commit SHA for a fixed version.

## Development

The action runs on Node 24 with no runtime dependencies, so `src/` is what runs: there is no
build step and nothing to commit besides source.

```bash
npm ci
npm test            # node:test
npm run lint        # ESLint
npm run format      # Prettier
```

Commits to `main` follow [Conventional Commits](https://www.conventionalcommits.org).
[release-please](https://github.com/googleapis/release-please) turns them into a release PR;
merging it tags `vX.Y.Z`, publishes a GitHub release, and moves the `vX` and `vX.Y` tags.

## License

[MIT](LICENSE)
