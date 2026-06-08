import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import pino from 'pino';
import { startScheduler } from './scheduler.js';
import { recentRuns } from './state.js';
import { holidayName } from './holidays.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 3030);
const startedAt = Date.now();

const scheduler = startScheduler(logger);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === 'GET /health') {
      return json(res, 200, {
        ok: true,
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        schedules: scheduler.schedules,
        todayHoliday: holidayName(),
      });
    }

    if (route === 'GET /runs') {
      const limit = Number(url.searchParams.get('limit') || 20);
      return json(res, 200, { runs: recentRuns(limit) });
    }

    if (route === 'POST /trigger/login') {
      const force = url.searchParams.get('force') === '1';
      const result = await scheduler.fire('login', { force });
      return json(res, 200, result);
    }

    if (route === 'POST /trigger/logout') {
      const force = url.searchParams.get('force') === '1';
      const result = await scheduler.fire('logout', { force });
      return json(res, 200, result);
    }

    return json(res, 404, { error: 'not found', route });
  } catch (err) {
    logger.error({ err, route }, 'request error');
    return json(res, 500, { error: 'internal server error' });
  }
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'keka-scheduler listening');
});

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  scheduler.loginJob.stop();
  scheduler.logoutJob.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
