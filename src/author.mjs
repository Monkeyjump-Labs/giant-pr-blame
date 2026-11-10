// Finds the Slack member ID of a PR's author.

// "Emma Westbrook", "emma.westbrook" and "emmawestbrook" all become "emmawestbrook".
export const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const NOREPLY = /@users\.noreply\.github\.com$/i;

// The author is pr.user: the person who opened the PR, not the latest committer or the
// actor who triggered the run, so a reviewer who pushes a fix does not inherit the shame.
// Returns null when no step finds exactly one person; the message then names the GitHub
// login instead.
//
//   1. By email. Candidates are the author's public GitHub email and the emails on their
//      commits in this PR and in the repo history. GitHub noreply addresses are skipped.
//      Each goes to Slack users.lookupByEmail (scope users:read.email).
//   2. By name, for authors who only commit with a noreply address. Lists the workspace
//      (scope users:read) and matches the GitHub name or login against each person's real
//      name, display name, handle and email local part, normalized. Only a single match
//      counts, so a common name never tags the wrong person.
export async function findSlackUser({ gh, slack, repo, pr, log }) {
  const login = pr.user.login;

  const user = await gh.request(`/users/${encodeURIComponent(login)}`);
  const [prCommits, repoCommits] = await Promise.all([
    gh.request(`/repos/${repo}/pulls/${pr.number}/commits?per_page=100`),
    gh.request(`/repos/${repo}/commits?author=${encodeURIComponent(login)}&per_page=100`),
  ]);
  const emails = new Set(
    [
      user.email,
      ...prCommits.filter((c) => c.author?.login === login).map((c) => c.commit.author.email),
      ...repoCommits.map((c) => c.commit.author.email),
    ].filter((e) => e && !NOREPLY.test(e)),
  );
  for (const email of emails) {
    const res = await slack.get('users.lookupByEmail', { email });
    if (res.ok && !res.user.deleted) return res.user.id;
    if (res.error !== 'users_not_found') log.warning(`Slack users.lookupByEmail: ${res.error}`);
  }

  const wanted = new Set([norm(user.name), norm(login)].filter(Boolean));
  const matches = new Set();
  let cursor;
  do {
    const res = await slack.get('users.list', { limit: '200', ...(cursor ? { cursor } : {}) });
    if (!res.ok) {
      log.warning(`Slack users.list: ${res.error}`);
      break;
    }
    for (const m of res.members) {
      if (m.deleted || m.is_bot || m.id === 'USLACKBOT') continue;
      const keys = [
        m.real_name,
        m.profile?.real_name,
        m.profile?.display_name,
        m.name,
        m.profile?.email?.split('@')[0],
      ];
      if (keys.some((k) => wanted.has(norm(k)))) matches.add(m.id);
    }
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);
  if (matches.size === 1) return [...matches][0];

  log.notice(
    `No single Slack user for ${login} (${matches.size} name matches); naming the GitHub login.`,
  );
  return null;
}
