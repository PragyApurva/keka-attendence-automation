#!/usr/bin/env node
// Injects Keka session tokens from the KEKA_SESSION env var into a fresh
// Chromium profile's localStorage LevelDB. Run this before run-action.js in CI.
//
// Usage:
//   KEKA_SESSION='<json>' KEKA_SUBDOMAIN='thinkhat.keka.com' node scripts/inject-session.js

import { ClassicLevel } from 'classic-level';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const PROFILE_DIR =
  process.env.PROFILE_DIR || path.join(os.homedir(), '.workctl', 'chromium_profile');
const DB_PATH = path.join(PROFILE_DIR, 'Default', 'Local Storage', 'leveldb');
const ORIGIN = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;

if (!process.env.KEKA_SESSION) {
  console.error('KEKA_SESSION env var is required');
  process.exit(1);
}

const session = JSON.parse(process.env.KEKA_SESSION);

fs.mkdirSync(DB_PATH, { recursive: true });

const db = new ClassicLevel(DB_PATH, { keyEncoding: 'buffer', valueEncoding: 'buffer' });
await db.open();

const batch = db.batch();
for (const [storageKey, value] of Object.entries(session)) {
  const key = Buffer.concat([
    Buffer.from(`_${ORIGIN}\x00\x01`, 'utf8'),
    Buffer.from(storageKey, 'utf8'),
  ]);
  const val = Buffer.concat([Buffer.from('\x01', 'utf8'), Buffer.from(value, 'utf8')]);
  batch.put(key, val);
}
await batch.write();
await db.close();

console.log(`Injected ${Object.keys(session).length} session keys for ${ORIGIN}`);
