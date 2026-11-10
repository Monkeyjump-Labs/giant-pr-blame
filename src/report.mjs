// What the action logs, sets as outputs and writes to the job summary.

// Workflow commands take one line; %, CR and LF must be escaped.
const escape = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

export const log = {
  info: (m) => console.log(m),
  notice: (m) => console.log(`::notice::${escape(m)}`),
  warning: (m) => console.log(`::warning::${escape(m)}`),
  error: (m) => console.log(`::error::${escape(m)}`),
};

export function outputs(result) {
  const m = result.metrics;
  return {
    giant: String(result.giant),
    posted: String(result.posted),
    skipped: result.skipped ?? '',
    lines: m ? String(m.lines) : '',
    files: m ? String(m.files) : '',
    components: m ? m.components.join(',') : '',
    'slack-user-id': result.slackUserId ?? '',
  };
}

export function summary(config, result) {
  if (result.skipped)
    return `### Giant PR check\n\n#${config.prNumber}: skipped (${result.skipped}).\n`;
  const { metrics: m, verdict: v } = result;
  const { big, absurd } = config.thresholds;
  const mark = (hit) => (hit ? ' :warning:' : '');
  const rows = [
    ['Weighted lines', m.lines, big.lines, absurd.lines, v.big.lines, v.absurd.lines],
    ['Files', m.files, big.files, absurd.files, v.big.files, v.absurd.files],
    [
      'Components',
      m.components.length,
      big.components,
      absurd.components,
      v.big.components,
      v.absurd.components,
    ],
  ].map(
    ([name, value, b, a, hb, ha]) => `| ${name} | ${value} | ${b}${mark(hb)} | ${a}${mark(ha)} |`,
  );
  const outcome = !result.giant
    ? 'Not giant.'
    : result.posted
      ? 'Giant. Labeled and posted to Slack.'
      : 'Giant. Dry run: not labeled, not posted.';
  return [
    '### Giant PR check',
    '',
    `#${config.prNumber}: **${outcome}**`,
    '',
    '| Metric | Value | Big | Absurd |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `+${m.additions} / -${m.deletions}, ${m.ignoredFiles} ignored files. ` +
      `Components: ${m.components.join(', ') || 'none'}.`,
    '',
  ].join('\n');
}
