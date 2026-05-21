#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { runAction, tail } from '../src/keka.js';
import { appendRun } from '../src/state.js';
import { holidayName } from '../src/holidays.js';

const TOKEN_FILE = path.resolve(process.env.TOKEN_FILE || '.keka-refresh-token');

const action = process.argv[2];
if (action !== 'login' && action !== 'logout') {
  console.error('Usage: run-action.js <login|logout>');
  process.exit(1);
}

// Load refresh token from file if env var not set
if (!process.env.KEKA_REFRESH_TOKEN) {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error(`No KEKA_REFRESH_TOKEN env var and no token file at ${TOKEN_FILE}`);
    console.error('Run: node scripts/export-session.js > .keka-refresh-token');
    process.exit(1);
  }
  process.env.KEKA_REFRESH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}

const logger = pino();
const force = process.env.FORCE === '1';

const holiday = holidayName();
if (holiday && !force) {
  console.log(`Skipping — today is ${holiday}`);
  appendRun({ action, status: 'skipped', reason: `holiday:${holiday}` });
  process.exit(0);
}

const result = await runAction(action, { logger });
const status = result.timedOut ? 'timeout' : result.exitCode === 0 ? 'ok' : 'failed';

appendRun({
  action,
  status,
  exitCode: result.exitCode,
  durationMs: result.durationMs,
  stdoutTail: tail(result.stdout),
  stderrTail: tail(result.stderr),
});

// Persist rotated refresh token back to file for next run
if (result.exitCode === 0) {
  const parsed = JSON.parse(result.stdout);
  if (parsed.refreshToken) fs.writeFileSync(TOKEN_FILE, parsed.refreshToken + '\n', 'utf8');
}

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
process.exit(result.exitCode);
