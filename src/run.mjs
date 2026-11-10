// Measures one pull request and, when it is giant, labels it and posts to Slack.

import { findSlackUser } from './author.mjs';
import { measure, verdict } from './measure.mjs';
import { message } from './message.mjs';

// The API returns at most 3000 files, 100 per page. A PR past 3000 files has bigger
// problems than an undercount.
export async function listFiles(gh, repo, prNumber) {
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await gh.request(
      `/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
    );
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

export async function run({ config, gh, slack, log, random = Math.random }) {
  const { repo, prNumber, label } = config;
  const result = {
    skipped: null,
    giant: false,
    posted: false,
    metrics: null,
    verdict: null,
    slackUserId: null,
    text: null,
  };

  const pr = await gh.request(`/repos/${repo}/pulls/${prNumber}`);
  if (pr.draft) {
    log.info(`#${prNumber} is a draft; it is judged when it is marked ready for review. Skipping.`);
    return { ...result, skipped: 'draft' };
  }
  if (pr.labels.some((l) => l.name === label)) {
    log.info(`#${prNumber} already has the ${label} label; the shame was posted once. Skipping.`);
    return { ...result, skipped: 'labeled' };
  }

  const metrics = measure(await listFiles(gh, repo, prNumber), config);
  const v = verdict(metrics, config.thresholds);
  log.info(JSON.stringify({ pr: prNumber, ...metrics, ...v }, null, 2));
  if (!v.giant) {
    log.info('Not giant. Carry on, citizen.');
    return { ...result, metrics, verdict: v };
  }

  const slackUserId = slack ? await findSlackUser({ gh, slack, repo, pr, log }) : null;
  const text = message({ pr, slackUserId, metrics, verdict: v, random });
  log.info(`Message:\n${text}`);
  const giant = { ...result, giant: true, metrics, verdict: v, slackUserId, text };
  if (config.dryRun) {
    log.info('dry-run: not labeling and not posting.');
    return giant;
  }

  // Label first, then post, so a later run does not post again. If the run dies between
  // the two steps the PR is labeled but not posted: a missed post beats a duplicate one.
  // If the post itself fails, remove the label so the next run tries again.
  await gh.request(`/repos/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  });

  try {
    const post = await slack.post('chat.postMessage', {
      channel: config.slackChannel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    });
    if (!post.ok) throw new Error(`Slack chat.postMessage failed: ${post.error}`);
  } catch (err) {
    await gh
      .request(`/repos/${repo}/issues/${prNumber}/labels/${encodeURIComponent(label)}`, {
        method: 'DELETE',
      })
      .catch((e) =>
        log.warning(`Could not remove the ${label} label after the failed post: ${e.message}`),
      );
    throw err;
  }

  return { ...giant, posted: true };
}
