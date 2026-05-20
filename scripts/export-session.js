#!/usr/bin/env node
// Reads the current Keka session tokens from Chromium's localStorage LevelDB
// and prints them as JSON. Pipe the output into a file, then store it as the
// KEKA_SESSION GitHub secret.
//
// Usage:
//   node scripts/export-session.js > /tmp/keka_session.json
//   # paste contents of /tmp/keka_session.json as the KEKA_SESSION secret

import { ClassicLevel } from 'classic-level';
import path from 'node:path';
import os from 'node:os';

const PROFILE_DIR =
  process.env.PROFILE_DIR || path.join(os.homedir(), '.workctl', 'chromium_profile');
const DB_PATH = path.join(PROFILE_DIR, 'Default', 'Local Storage', 'leveldb');
const ORIGIN = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;

const PREFIX = Buffer.from(`_${ORIGIN}\x00\x01`, 'utf8');

const db = new ClassicLevel(DB_PATH, { keyEncoding: 'buffer', valueEncoding: 'buffer' });

// Only export auth tokens — skip large app-cache blobs (bkn:cache:*)
const AUTH_KEYS = new Set([
  'access_token', 'access_token_stored_at', 'expires_at', 'granted_scopes',
  'id_token', 'id_token_claims_obj', 'id_token_expires_at', 'id_token_stored_at',
  'loginDate', 'nonce', 'refresh_token', 'sasTokenDetails', 'session_state',
  'dynamicValues', 'showNotificationPromptAfter', 'PKCE_verifier',
]);

const session = {};
for await (const [key, value] of db.iterator()) {
  if (key.slice(0, PREFIX.length).equals(PREFIX)) {
    const storageKey = key.slice(PREFIX.length).toString('utf8');
    if (!AUTH_KEYS.has(storageKey)) continue;
    // Value format: \x01 + actual value
    const storageValue = value.slice(1).toString('utf8');
    session[storageKey] = storageValue;
  }
}
await db.close();

if (Object.keys(session).length === 0) {
  console.error(`No localStorage entries found for origin: ${ORIGIN}`);
  console.error('Run npm run setup-session first.');
  process.exit(1);
}

console.log(JSON.stringify(session, null, 2));
