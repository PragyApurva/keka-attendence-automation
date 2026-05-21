#!/usr/bin/env node
// Exchange KEKA_REFRESH_TOKEN for a fresh access_token + new refresh_token.
// Outputs JSON to stdout: { access_token, refresh_token }
import 'dotenv/config';
import { refreshAccessToken } from '../src/keka.js';

const refreshToken = process.env.KEKA_REFRESH_TOKEN;
if (!refreshToken) {
  console.error('KEKA_REFRESH_TOKEN env var is required');
  process.exit(1);
}

try {
  const tokens = await refreshAccessToken(refreshToken);
  console.log(JSON.stringify({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }));
} catch (err) {
  if (err.code === 'invalid_grant') {
    console.error('');
    console.error('================================================================');
    console.error('  KEKA_REFRESH_TOKEN is expired or revoked (invalid_grant)');
    console.error('================================================================');
    console.error('');
    console.error('The refresh token chain is dead. You must re-authenticate once:');
    console.error('');
    console.error('  1. Open https://thinkhat.keka.com in your browser and log in');
    console.error('  2. Open DevTools → Network tab → filter for "connect/token"');
    console.error('  3. Find the POST request → Response tab');
    console.error('  4. Copy the "refresh_token" value');
    console.error('  5. Update the GitHub secret:');
    console.error('       gh secret set KEKA_REFRESH_TOKEN --body "<paste_token_here>"');
    console.error('');
    process.exit(2);
  }
  console.error(err.message);
  process.exit(1);
}
