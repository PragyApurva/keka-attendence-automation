import https from 'node:https';

const KEKA_BASE = `https://${process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com'}`;
const ACTION_TIMEOUT_MS = 30_000;

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const bodyBuf = Buffer.from(body);
    const req = https.request(
      {
        hostname,
        path: pathname + (search ?? ''),
        method: 'POST',
        headers: { ...headers, 'Content-Length': bodyBuf.length },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

async function clockAction(action) {
  const rawToken = process.env.KEKA_ACCESS_TOKEN;
  if (!rawToken) throw new Error('KEKA_ACCESS_TOKEN env var is required');

  // Accept both "Bearer <token>" and raw token
  const accessToken = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

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

const KEKA_CLIENT_ID = '987cc971-fc22-4454-99f9-16c078fa7ff6';

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: KEKA_CLIENT_ID,
  }).toString();

  const subdomain = process.env.KEKA_SUBDOMAIN || 'thinkhat.keka.com';
  const { status, body: respBody } = await httpsPost(
    'https://app.keka.com/connect/token',
    body,
    {
      'content-type': 'application/x-www-form-urlencoded',
      'origin': `https://${subdomain}`,
      'referer': `https://${subdomain}/`,
    },
  );

  if (status < 200 || status >= 300) {
    let parsed = {};
    try { parsed = JSON.parse(respBody); } catch {}
    const err = new Error(`Token refresh failed (${status}): ${respBody}`);
    err.code = parsed.error ?? 'refresh_failed';
    throw err;
  }

  const data = JSON.parse(respBody);
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function tail(str, n = 500) {
  if (!str) return '';
  return str.length > n ? str.slice(-n) : str;
}
