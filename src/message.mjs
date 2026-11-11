// The Slack message. Lightly accusatory by design: it blames the PR, never the person.
//
// A message is: one opener, one roast per threshold crossed (picked from that threshold's
// pool), up to one bonus line about the PR's shape, the stats line, and one closer. Every
// pool is picked from at random, so the same PR rarely gets the same message twice.
//
// Each joke should have its own shape. A sentence frame ("That is not X, that is Y") or an
// opening that one line uses should not show up in another, so a channel that sees many
// giant PRs does not start to recognise the template. The tests check for repeats.

const fmt = (n) => n.toLocaleString('en-US');

// Slack mrkdwn treats <, > and & as control characters.
const plain = (s) => s.replace(/[<>&]/g, '');

export const OPENERS = [
  (who, link) =>
    `:rotating_light: Attention, reviewers. ${who} has opened ${link}, and it is not small.`,
  (who, link) => `:elephant: A wild giant PR appeared! ${who} summoned ${link}.`,
  (who, link) => `:scroll: Hear ye, hear ye. ${who} hath delivered ${link}, and lo, it is long.`,
  (who, link) => `:truck: Beep beep. ${who} just backed a dump truck of code up to ${link}.`,
  (who, link) =>
    `:ocean: No shoreline is visible from anywhere in ${link}. Lifeguard on duty: ${who}.`,
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
    `:loudspeaker: Would the owner of ${link} please come to the front desk. ${who}, your PR is blocking the aisle.`,
  (who, link) => `:whale: Thar she blows! ${who} has harpooned the review queue with ${link}.`,
  (who, link) => `:construction: Hard hats on, everyone. ${who} has broken ground on ${link}.`,
  (who, link) =>
    `:clapper: Previously, on "Small PRs": nothing, because ${who} just opened ${link}.`,
  (who, link) =>
    `:moyai: The ancients spoke of a PR so large it had its own weather. ${who} made it real: ${link}.`,
  (who, link) => `:ship: Tugboats are on their way to guide ${link} into port. Captain: ${who}.`,
  (who, link) =>
    `:weight_lifter: ${who} has asked the team to review ${link}. We have started stretching.`,
  (who, link) =>
    `:tornado: A PR warning is in effect for the review queue. ${link} by ${who} has made landfall.`,
  (who, link) =>
    `:crystal_ball: The prophecy foretold a PR of unusual size. ${who} has fulfilled it: ${link}.`,
  (who, link) => `:pizza: ${who} ordered a family-size PR: ${link}. Extra everything.`,
  (who, link) =>
    `:newspaper: Breaking news: ${who} has filed ${link}, and early estimates suggest it is "a lot".`,
  (who, link) =>
    `:european_castle: Behold the castle ${who} built where a feature was asked for: ${link}.`,
  (who, link) =>
    `:satellite: Ground control to the review team. ${link} by ${who} has entered orbit.`,
  (who, link) =>
    `:popcorn: Grab a seat, everyone. ${who} has premiered ${link}, and the runtime is long.`,
  (who, link) =>
    `:mountain: ${who} looked at the review queue and asked, "What if it were a mountain?" Behold: ${link}.`,
  (who, link) => `:bell: Ding ding. ${who} rang the giant PR bell with ${link}.`,
  (who, link) => `:dragon: Here be dragons. Specifically, ${link}. Specifically, ${who}.`,
  (who, link) => `:receipt: ${who} checked out ${link}. The receipt alone is longer than most PRs.`,
  (who, link) => `:balloon: ${who} has inflated ${link} to a size we did not think was possible.`,
  (who, link) =>
    `:jigsaw: Here is a 5,000-piece puzzle with no picture on the box: ${link}, courtesy of ${who}.`,
  (who, link) => `:hourglass: Clear your calendars. ${who} has scheduled ${link}.`,
  (who, link) =>
    `:circus_tent: Step right up! ${who} presents ${link}, the greatest diff on earth.`,
  (who, link) => `:train: All aboard ${link}. Conductor: ${who}. Arrival time: unknown.`,
  (who, link) =>
    `:octopus: Something enormous has surfaced in the review queue. Witnesses describe ${link} and say ${who} was seen nearby.`,
];

export const CLOSERS = [
  'Somebody check on the reviewer. :pray:',
  'Could this have been a stack? (Rhetorical. Yes.)',
  'We are not mad. We are just disappointed. And a little scared.',
  '"LGTM" on this one will be considered perjury.',
  'Remember: the PR template does not have a "trust me" checkbox.',
  'An investigation into who did this has concluded in record time.',
  'Thoughts and prayers to whoever is assigned.',
  'In lieu of flowers, please send reviewers.',
  'This message will repeat on every giant PR until morale improves.',
  'Small PRs. Small PRs. Small PRs. Say it with us.',
  'Fun fact: it is never too late to split a PR. Today, for example, is not too late.',
  'Reviewers, remember to hydrate.',
  'Estimated review time: yes.',
  'Please keep your hands and feet inside the diff at all times.',
  'The team would like to remind everyone that "one more small change" is how this started.',
  'The next of kin of every reviewer have been informed.',
  'Somewhere, a CI runner just sighed.',
  'No PRs were harmed in the making of this message. Several reviewers were.',
  'Please rate your reviewing experience from 1 to "I need a nap".',
  'Have you tried turning it into three PRs and back on again?',
  'History will remember this PR. Reviewers will try to forget it.',
  'Bold of you to assume anyone will read every line.',
  'This is fine. :fire:',
  '"Mostly just moving things around" has never once been true.',
  'The reviewers have unionized.',
  'If found, please return the original scope to the ticket.',
  'Approving this without reading it is a lifestyle choice.',
  'We will be telling our grandchildren about this one.',
  'Brought to you by the Committee for Smaller Pull Requests.',
  'Merge conflicts are sold separately and arrive tomorrow.',
  'Please allow 6 to 8 weeks for approval.',
  'A moment of silence for the notification bell.',
  'Reviewers who reach the last line will receive a commemorative badge.',
];

const names = (m) => m.components.join(', ');

// One pool per threshold. Each entry takes the metrics and returns the line.
export const ROASTS = {
  big: {
    lines: [
      (m) => `This diff runs ${fmt(m.lines)} weighted lines, which is roughly novella length.`,
      (m) => `Some books are shorter than these ${fmt(m.lines)} weighted lines.`,
      (m) => `The scroll bar took one look at ${fmt(m.lines)} weighted lines and shrank to a dot.`,
      (m) => `Printed out, ${fmt(m.lines)} weighted lines would be a fire hazard.`,
      (m) =>
        `Reading ${fmt(m.lines)} weighted lines at one per second takes ${fmtDuration(m.lines)}. No breaks.`,
      (m) => `The Guinness people have been called about ${fmt(m.lines)} weighted lines.`,
      (m) => `With ${fmt(m.lines)} weighted lines, the diff has started numbering its chapters.`,
      (m) => `"Quick fix", they said. ${fmt(m.lines)} weighted lines later, here we are.`,
      (m) => `${fmt(m.lines)} weighted lines. That is not a pull request, that is a push request.`,
      (m) => `The mouse wheel has filed a complaint about ${fmt(m.lines)} weighted lines.`,
      (m) => `Entire microservices have shipped with fewer than ${fmt(m.lines)} lines.`,
      (m) =>
        `Around line ${fmt(Math.round(m.lines / 2))}, reviewers will forget where they started.`,
    ],
    files: [
      (m) => `${fmt(m.files)} files. The "Files changed" tab needs a lie down.`,
      (m) => `Just reading the names of all ${fmt(m.files)} files counts as a review.`,
      (m) => `Reviewers will need a map and a compass to cross ${fmt(m.files)} files.`,
      (m) => `Across ${fmt(m.files)} files, the file tree has grown a file tree of its own.`,
      (m) => `Some of these ${fmt(m.files)} files have never met each other before today.`,
      (m) => `Clicking "Viewed" ${fmt(m.files)} times counts as cardio.`,
      (m) => `Even \`git status\` looked away from ${fmt(m.files)} files.`,
      (m) => `Nobody touch anything else. This PR already touched ${fmt(m.files)} files.`,
      (m) => `Bookmark your place. There are ${fmt(m.files)} files and no save points.`,
    ],
    components: [
      (m) => `${m.components.length} components (${names(m)}). Cross-component pollution detected.`,
      (m) => `A grand tour of the codebase, with stops in ${names(m)}.`,
      (m) => `Every team gets a gift! Today's lucky components: ${names(m)}.`,
      (m) => `The CODEOWNERS file just got a group chat: ${names(m)}.`,
      (m) =>
        `After visiting ${m.components.length} components (${names(m)}), this PR has more frequent-flyer miles than most of us.`,
      (m) => `Boundaries are healthy. This PR ignored the ones between ${names(m)}.`,
      (m) => `Would ${names(m)} please report to the review room.`,
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
      () => 'Someone should write the CliffsNotes.',
      () => 'Base camp for reviewing this diff opens at dawn.',
    ],
    files: [
      () => 'GitHub has started lazy-loading the diff out of self-defense.',
      () => 'The "Load diff" button is doing a lot of heavy lifting today.',
      () => 'The file list needs its own table of contents.',
      () => 'There are files in this PR that the author has never opened.',
      () => 'Browser tabs are crashing in solidarity.',
      () => 'At least one file in here changed by accident.',
    ],
    components: [
      () => 'Paperwork for a hostile takeover has been filed.',
      () => 'The org chart may need updating after this one.',
      () => 'Every component in the repo has received a postcard from this PR.',
      () => 'Release notes for this one will need an index.',
      () => 'This PR has been nominated for a monorepo lifetime achievement award.',
      () => 'Architects have been called in to redraw the diagram.',
    ],
  },
};

// Lines about the PR's shape. At most one is picked, from the ones that apply.
export const BONUSES = [
  {
    when: (m) => m.deletions > m.additions * 2,
    lines: [
      'To be fair, it is mostly deletions. We see you, Marie Kondo. :sparkles:',
      'The deletions outnumber the additions, which is nice. There are still a lot of them.',
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
      (m) =>
        `${fmt(m.ignoredFiles)} lock or generated files came along for the ride, and they ride free.`,
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
