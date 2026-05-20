#!/usr/bin/env node
// Reads the refresh_token from Chromium's localStorage LevelDB and prints it.
// Store the output as the KEKA_REFRESH_TOKEN GitHub secret.
//
// Usage:
//   node scripts/export-session.js

import { ClassicLevel } from 'classic-level';
import path from 'node:path';
import os from 'node:os';

const PROFILE_DIR =
  process.env.PROFILE_DIR || path.join(os.homedir(), '.workctl', 'chromium_profile');
const DB_PATH = path.join(PROFILE_DIR, 'Default', 'Local Storage', 'leveldb');
const ORIGIN = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;

const KEY = Buffer.from(`_${ORIGIN}\x00\x01refresh_token`, 'utf8');

const db = new ClassicLevel(DB_PATH, { keyEncoding: 'buffer', valueEncoding: 'buffer' });
const value = await db.get(KEY).catch(() => null);
await db.close();

if (!value) {
  console.error(`refresh_token not found for origin: ${ORIGIN}`);
  console.error('Run npm run setup-session first.');
  process.exit(1);
}

// Value format: \x01 + actual value
console.log(value.slice(1).toString('utf8'));
