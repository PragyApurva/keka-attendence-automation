import https from 'node:https';
import { URLSearchParams } from 'node:url';

const KEKA_BASE = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;
const TOKEN_ENDPOINT = 'https://app.keka.com/connect/token';
const CLIENT_ID = '987cc971-fc22-4454-99f9-16c078fa7ff6';
const ACTION_TIMEOUT_MS = 30_000;

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const path = pathname + (search ?? '');
    const bodyBuf = Buffer.from(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': bodyBuf.length } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// Returns { accessToken, newRefreshToken } — newRefreshToken may differ if server rotates tokens.
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  }).toString();

  const { status, body: resBody } = await httpsPost(TOKEN_ENDPOINT, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (status !== 200) throw new Error(`Token refresh failed (${status}): ${resBody}`);

  const data = JSON.parse(resBody);
  if (!data.access_token) throw new Error('Token refresh response missing access_token');
  return { accessToken: data.access_token, newRefreshToken: data.refresh_token ?? refreshToken };
}

async function clockAction(action) {
  const refreshToken = process.env.KEKA_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('KEKA_REFRESH_TOKEN env var is required');

  const { accessToken, newRefreshToken } = await refreshAccessToken(refreshToken);
  if (newRefreshToken !== refreshToken) process.env.KEKA_REFRESH_TOKEN = newRefreshToken;

  const { hostname, pathname } = new URL(KEKA_BASE);
  const reqBody = JSON.stringify({
    timestamp: new Date().toISOString(),
    attendanceLogSource: 1,
    locationAddress: null,
    manualClockinType: 1,
    note: '',
    // 0 = clock-in, 1 = clock-out
    originalPunchStatus: action === 'login' ? 0 : 1,
  });

  const { status, body } = await httpsPost(
    `${KEKA_BASE}/k/dashboard/api/mytime/attendance/webclockin`,
    reqBody,
    {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'origin': KEKA_BASE,
      'referer': `${KEKA_BASE}/`,
      'x-requested-with': 'XMLHttpRequest',
    },
  );

  if (status < 200 || status >= 300) throw new Error(`Clock ${action} failed (${status}): ${body}`);
  return { punched: true, response: body, refreshToken: process.env.KEKA_REFRESH_TOKEN };
}

export async function runAction(action, { logger } = {}) {
  if (action !== 'login' && action !== 'logout') {
    throw new Error(`invalid action: ${action}`);
  }

  const startedAt = Date.now();

  try {
    const result = await Promise.race([
      clockAction(action),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`action timed out after ${ACTION_TIMEOUT_MS}ms`)),
          ACTION_TIMEOUT_MS,
        ),
      ),
    ]);
    return {
      exitCode: 0,
      stdout: JSON.stringify(result),
      stderr: '',
      durationMs: Date.now() - startedAt,
      timedOut: false,
    };
  } catch (err) {
    const timedOut = err.message.includes('timed out');
    return {
      exitCode: 1,
      stdout: '',
      stderr: err.stack || String(err),
      durationMs: Date.now() - startedAt,
      timedOut,
    };
  }
}

export function tail(str, n = 500) {
  if (!str) return '';
  return str.length > n ? str.slice(-n) : str;
}
