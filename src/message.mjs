// The Slack message. Lightly accusatory by design.

const fmt = (n) => n.toLocaleString('en-US');

// Slack mrkdwn treats <, > and & as control characters.
const plain = (s) => s.replace(/[<>&]/g, '');

export const OPENERS = [
  (who, link) =>
    `:rotating_light: Attention, reviewers. ${who} has opened ${link}, and it is not small.`,
  (who, link) => `:elephant: A wild giant PR appeared! ${who} summoned ${link}.`,
  (who, link) => `:scroll: Hear ye, hear ye. ${who} hath delivered ${link}, and lo, it is long.`,
  (who, link) => `:truck: Beep beep. ${who} just backed a dump truck of code up to ${link}.`,
  (who, link) => `:ocean: ${who} did not open a PR. They opened an ocean: ${link}.`,
  (who, link) =>
    `:mag: Scientists have discovered a new largest PR. It belongs to ${who}: ${link}.`,
  (who, link) =>
    `:package: Your delivery from ${who} has arrived. Please lift with your legs: ${link}.`,
];

export const CLOSERS = [
  'Somebody check on the reviewer. :pray:',
  'Could this have been a stack? (Rhetorical. Yes.)',
  'We are not mad. We are just disappointed. And a little scared.',
  '"LGTM" on this one will be considered perjury.',
  'Remember: the PR template does not have a "trust me" checkbox.',
  'Who did this? (We know who did this.)',
];

export function roasts(m, v) {
  const out = [];
  if (v.big.lines)
    out.push(`${fmt(m.lines)} weighted lines. That is not a diff, that is a novella.`);
  if (v.big.files) out.push(`${fmt(m.files)} files. The "Files changed" tab needs a lie down.`);
  if (v.big.components) {
    out.push(
      `${m.components.length} components (${m.components.join(', ')}). Cross-component pollution detected.`,
    );
  }
  if (v.absurd.lines) out.push('Reviewers have been advised to pack snacks.');
  if (v.absurd.files) out.push('GitHub has started lazy-loading the diff out of self-defense.');
  if (v.absurd.components) out.push('At this point it is less a PR and more a hostile takeover.');
  return out;
}

// `random` returns a number in [0, 1); injectable so tests are deterministic.
export function message({ pr, slackUserId, metrics: m, verdict: v, random = Math.random }) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const who = slackUserId ? `<@${slackUserId}>` : `*${plain(pr.user.login)}*`;
  const link = `<${pr.html_url}|#${pr.number} ${plain(pr.title)}>`;

  const stats =
    `+${fmt(m.additions)} / -${fmt(m.deletions)} · ${fmt(m.files)} files` +
    (m.ignoredFiles ? ` (+${fmt(m.ignoredFiles)} lock/generated, not counted)` : '') +
    (m.components.length ? ` · components: ${m.components.join(', ')}` : '');

  return [
    pick(OPENERS)(who, link),
    ...roasts(m, v).map((r) => `• ${r}`),
    `_${stats}_`,
    pick(CLOSERS),
  ].join('\n');
}
