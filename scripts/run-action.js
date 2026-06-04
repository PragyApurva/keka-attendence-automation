#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { fireAction } from '../src/scheduler.js';

const TOKEN_FILE = path.resolve(process.env.TOKEN_FILE || '.keka-access-token');

const action = process.argv[2];
if (action !== 'login' && action !== 'logout') {
  console.error('Usage: run-action.js <login|logout>');
  process.exit(1);
}

// Load access token from file if env var not set
if (!process.env.KEKA_ACCESS_TOKEN) {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error(`No KEKA_ACCESS_TOKEN env var and no token file at ${TOKEN_FILE}`);
    console.error('Run: node scripts/export-session.js > .keka-access-token');
    process.exit(1);
  }
  process.env.KEKA_ACCESS_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}

const logger = pino();
const force = process.env.FORCE === '1';

const entry = await fireAction(action, logger, { force });
const exitCode = entry.status === 'failed' || entry.status === 'timeout' ? 1 : 0;

if (entry.stdoutTail) console.log(entry.stdoutTail);
if (entry.stderrTail) console.error(entry.stderrTail);
process.exit(exitCode);
