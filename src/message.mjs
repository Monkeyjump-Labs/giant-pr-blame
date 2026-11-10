// The Slack message. Lightly accusatory by design: it blames the PR, never the person.
//
// A message is: one opener, one roast per threshold crossed (picked from that threshold's
// pool), up to one bonus line about the PR's shape, the stats line, and one closer. Every
// pool is picked from at random, so the same PR rarely gets the same message twice.

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
  (who, link) => `:earth_americas: ${link} by ${who} is now visible from space.`,
  (who, link) =>
    `:t-rex: In a world where PRs were small... ${who} dared to dream bigger. ${link}, coming to a review queue near you.`,
  (who, link) =>
    `:books: ${who} has published ${link}. It is available in hardcover, paperback, and three volumes.`,
  (who, link) =>
    `:volcano: Seismologists report a major event in the repo. Epicenter: ${link}. Cause: ${who}.`,
  (who, link) =>
    `:loudspeaker: Would the owner of ${link} please come to the front desk. Oh wait, we know who it is. Hi, ${who}.`,
  (who, link) => `:whale: Thar she blows! ${who} has harpooned the review queue with ${link}.`,
  (who, link) => `:construction: ${who} opened ${link}. Reviewers, please put on your hard hats.`,
  (who, link) =>
    `:clapper: Previously, on "Small PRs": nothing, because ${who} just opened ${link}.`,
  (who, link) =>
    `:moyai: The ancients spoke of a PR so large it had its own weather. ${who} has opened ${link}.`,
  (who, link) =>
    `:ship: ${who} has launched ${link}. It is less a pull request and more a container ship.`,
  (who, link) =>
    `:weight_lifter: ${who} has asked the team to review ${link}. We have started stretching.`,
  (who, link) =>
    `:tornado: A PR warning is in effect for the review queue. ${link} by ${who} has made landfall.`,
  (who, link) =>
    `:crystal_ball: The prophecy foretold a PR of unusual size. ${who} has fulfilled it: ${link}.`,
  (who, link) => `:pizza: ${who} ordered a family-size PR: ${link}. Extra everything.`,
  (who, link) =>
    `:newspaper: Breaking news: ${who} has opened ${link}, and early estimates suggest it is "a lot".`,
  (who, link) => `:european_castle: ${who} did not build a feature. They built a castle: ${link}.`,
  (who, link) =>
    `:satellite: Ground control to the review team. ${link} by ${who} has entered orbit.`,
  (who, link) =>
    `:popcorn: Grab a seat, everyone. ${who} has premiered ${link}, and the runtime is long.`,
  (who, link) =>
    `:mountain: ${who} looked at the review queue and asked, "What if it were a mountain?" Behold: ${link}.`,
  (who, link) => `:bell: Ding ding. ${who} rang the giant PR bell with ${link}.`,
  (who, link) => `:dragon: Here be dragons. Specifically, ${link}. Specifically, ${who}.`,
  (who, link) => `:receipt: ${who} has opened ${link}. The receipt alone is longer than most PRs.`,
  (who, link) => `:balloon: ${who} has inflated ${link} to a size we did not think was possible.`,
];

export const CLOSERS = [
  'Somebody check on the reviewer. :pray:',
  'Could this have been a stack? (Rhetorical. Yes.)',
  'We are not mad. We are just disappointed. And a little scared.',
  '"LGTM" on this one will be considered perjury.',
  'Remember: the PR template does not have a "trust me" checkbox.',
  'Who did this? (We know who did this.)',
  'Thoughts and prayers to whoever is assigned.',
  'In lieu of flowers, please send reviewers.',
  'This message will repeat on every giant PR until morale improves.',
  'Small PRs. Small PRs. Small PRs. (We will keep saying it.)',
  'Fun fact: it is never too late to split a PR. Today, for example, is not too late.',
  'Reviewers, remember to hydrate.',
  'Estimated review time: yes.',
  'Please keep your hands and feet inside the diff at all times.',
  'The team would like to remind everyone that "one more small change" is how this started.',
  'We have notified the next of kin. (The reviewers.)',
  'Somewhere, a CI runner just sighed.',
  'No PRs were harmed in the making of this message. Several reviewers were.',
  'Please rate your reviewing experience from 1 to "I need a nap".',
  'Have you tried turning it into three PRs and back on again?',
  'History will remember this PR. Reviewers will try to forget it.',
  'Bold of you to assume anyone will read every line.',
  'This is fine. :fire:',
  'Do not worry, it is "mostly just moving things around". (It is never just moving things around.)',
  'The reviewers have unionized.',
  'If found, please return the original scope to the ticket.',
  'Approving this without reading it is a lifestyle choice.',
  'We will be telling our grandchildren about this one.',
  'Brought to you by the Committee for Smaller Pull Requests.',
  'Merge conflicts not included. (They will be.)',
];

// One pool per threshold. Each entry takes the metrics and returns the line.
export const ROASTS = {
  big: {
    lines: [
      (m) => `${fmt(m.lines)} weighted lines. That is not a diff, that is a novella.`,
      (m) => `${fmt(m.lines)} weighted lines. Some books are shorter.`,
      (m) => `${fmt(m.lines)} weighted lines. The scroll bar has given up and become a dot.`,
      (m) => `${fmt(m.lines)} weighted lines. Printed out, this would be a fire hazard.`,
      (m) =>
        `${fmt(m.lines)} weighted lines. At one line per second, review ends in ${fmtDuration(m.lines)}.`,
      (m) => `${fmt(m.lines)} weighted lines. Somebody call the Guinness people.`,
      (m) => `${fmt(m.lines)} weighted lines. The diff has chapters now.`,
      (m) => `${fmt(m.lines)} weighted lines. "Quick fix", they said.`,
      (m) => `${fmt(m.lines)} weighted lines. That is not a pull request, that is a push request.`,
      (m) => `${fmt(m.lines)} weighted lines. The mouse wheel has filed a complaint.`,
    ],
    files: [
      (m) => `${fmt(m.files)} files. The "Files changed" tab needs a lie down.`,
      (m) => `${fmt(m.files)} files. That is not a PR, that is a directory listing.`,
      (m) => `${fmt(m.files)} files. Reviewers will need a map and a compass.`,
      (m) => `${fmt(m.files)} files. The file tree now has its own file tree.`,
      (m) => `${fmt(m.files)} files. Some of them have never met each other before today.`,
      (m) => `${fmt(m.files)} files. We are going to need a bigger "Viewed" checkbox.`,
      (m) => `${fmt(m.files)} files. Even \`git status\` looked away.`,
      (m) => `${fmt(m.files)} files touched. Nobody touch anything else.`,
    ],
    components: [
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). Cross-component pollution detected.`,
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). A grand tour of the codebase.`,
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). Every team gets a gift!`,
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). The CODEOWNERS file just got a group chat.`,
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). This PR has more frequent-flyer miles than most of us.`,
      (m) =>
        `${m.components.length} components (${m.components.join(', ')}). Boundaries are healthy. This PR has none.`,
    ],
  },
  absurd: {
    lines: [
      () => 'Reviewers have been advised to pack snacks.',
      () => 'The diff has been reclassified as a long-form podcast.',
      () => 'Line numbers in this PR now need a comma.',
      () => 'At this size, the PR is legally a codebase.',
      () => 'Experts recommend reviewing this in shifts.',
      () => 'The diff view is now available as a season pass.',
    ],
    files: [
      () => 'GitHub has started lazy-loading the diff out of self-defense.',
      () => 'The "Load diff" button is doing a lot of heavy lifting today.',
      () => 'The file list needs its own table of contents.',
      () => 'There are files in this PR that the author has never opened.',
      () => 'Browser tabs are crashing in solidarity.',
    ],
    components: [
      () => 'At this point it is less a PR and more a hostile takeover.',
      () => 'This is not a change. This is a reorg.',
      () => 'Every component in the repo has received a postcard from this PR.',
      () => 'Release notes for this one will need an index.',
      () => 'This PR has been nominated for a monorepo lifetime achievement award.',
    ],
  },
};

// Lines about the PR's shape. At most one is picked, from the ones that apply.
export const BONUSES = [
  {
    when: (m) => m.deletions > m.additions * 2,
    lines: [
      'To be fair, it is mostly deletions. We see you, Marie Kondo. :sparkles:',
      'Mostly deletions, which is nice. Still a lot of deletions, though.',
      'It is mostly red, which is the good kind of giant. Mostly.',
    ],
  },
  {
    when: (m) => m.additions > 0 && m.deletions === 0,
    lines: [
      'Zero deletions. Not one. Everything is new and everything is here.',
      'Not a single line removed. A bold, additive vision.',
    ],
  },
  {
    when: (m) => m.additions > m.deletions * 10 && m.deletions > 0,
    lines: [
      'For every line removed, more than ten were added. The codebase thanks you for the snack.',
      'Almost all of it is new. It is like a fresh repo, but inside the old repo.',
    ],
  },
  {
    when: (m) => m.ignoredFiles >= 3,
    lines: [
      (m) =>
        `And ${fmt(m.ignoredFiles)} lock or generated files on top. We did not even count those. We were being nice.`,
    ],
  },
];

// Seconds, in the largest whole unit that reads well.
function fmtDuration(seconds) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours`;
}

const render = (entry, m) => (typeof entry === 'function' ? entry(m) : entry);

export function roasts(m, v, pick = (list) => list[0]) {
  const out = [];
  for (const tier of ['big', 'absurd']) {
    for (const metric of ['lines', 'files', 'components']) {
      if (v[tier][metric]) out.push(pick(ROASTS[tier][metric])(m));
    }
  }
  return out;
}

export function bonus(m, pick = (list) => list[0]) {
  const applies = BONUSES.filter((b) => b.when(m));
  if (!applies.length) return null;
  return render(pick(pick(applies).lines), m);
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

  const extra = bonus(m, pick);
  return [
    pick(OPENERS)(who, link),
    ...roasts(m, v, pick).map((r) => `• ${r}`),
    ...(extra ? [`• ${extra}`] : []),
    `_${stats}_`,
    pick(CLOSERS),
  ].join('\n');
}
