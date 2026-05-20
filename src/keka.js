const KEKA_BASE = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;
const TOKEN_ENDPOINT = 'https://app.keka.com/connect/token';
const CLIENT_ID = '987cc971-fc22-4454-99f9-16c078fa7ff6';
const ACTION_TIMEOUT_MS = 30_000;

async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const { access_token } = await res.json();
  if (!access_token) throw new Error('Token refresh response missing access_token');
  return access_token;
}

async function clockAction(action) {
  const refreshToken = process.env.KEKA_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('KEKA_REFRESH_TOKEN env var is required');

  const accessToken = await refreshAccessToken(refreshToken);

  // originalPunchStatus 0 = clock-in, 1 = clock-out
  const originalPunchStatus = action === 'login' ? 0 : 1;

  const res = await fetch(`${KEKA_BASE}/k/dashboard/api/mytime/attendance/webclockin`, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'origin': KEKA_BASE,
      'referer': `${KEKA_BASE}/`,
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      attendanceLogSource: 1,
      locationAddress: null,
      manualClockinType: 1,
      note: '',
      originalPunchStatus,
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Clock ${action} failed (${res.status}): ${body}`);
  return { punched: true, response: body };
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
        setTimeout(() => reject(new Error(`action timed out after ${ACTION_TIMEOUT_MS}ms`)), ACTION_TIMEOUT_MS),
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
