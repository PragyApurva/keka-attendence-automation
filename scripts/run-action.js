#!/usr/bin/env node
import 'dotenv/config';
import pino from 'pino';
import { runAction, tail } from '../src/keka.js';
import { appendRun } from '../src/state.js';
import { holidayName } from '../src/holidays.js';

const action = process.argv[2];
if (action !== 'login' && action !== 'logout') {
  console.error('Usage: run-action.js <login|logout>');
  process.exit(1);
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

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
process.exit(result.exitCode);
