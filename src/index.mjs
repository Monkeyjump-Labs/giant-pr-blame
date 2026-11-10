// Action entry point: inputs in, outputs and a job summary out.

import { appendFileSync } from 'node:fs';
import { createGitHub, createSlack } from './clients.mjs';
import { inputReader, readConfig } from './config.mjs';
import { log, outputs, summary } from './report.mjs';
import { run } from './run.mjs';

async function main(env = process.env) {
  const config = readConfig(inputReader(env), env);
  const gh = createGitHub({ token: config.githubToken, apiUrl: env.GITHUB_API_URL || undefined });
  const slack = config.slackToken ? createSlack({ token: config.slackToken }) : null;

  const result = await run({ config, gh, slack, log });

  if (env.GITHUB_OUTPUT) {
    const out = Object.entries(outputs(result)).map(([k, v]) => `${k}=${v}\n`);
    appendFileSync(env.GITHUB_OUTPUT, out.join(''));
  }
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary(config, result));
}

main().catch((err) => {
  log.error(err.message);
  console.error(err);
  process.exitCode = 1;
});
