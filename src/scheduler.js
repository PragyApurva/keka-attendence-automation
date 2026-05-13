import cron from 'node-cron';
import { runAction, tail } from './keka.js';
import { holidayName } from './holidays.js';
import { appendRun } from './state.js';

const TZ = process.env.TZ_NAME || 'Asia/Kolkata';

const LOGIN_CRON = '30 9 * * 1-5';   // 09:30 Mon-Fri
const LOGOUT_CRON = '0 20 * * 1-5';  // 20:00 Mon-Fri

async function fire(action, logger, { force = false } = {}) {
  const holiday = holidayName();
  if (holiday && !force) {
    const entry = { action, status: 'skipped', reason: `holiday:${holiday}` };
    appendRun(entry);
    logger.info(entry, 'skipped due to holiday');
    return entry;
  }

  logger.info({ action }, 'firing keka action');
  const result = await runAction(action, { logger });
  const status = result.timedOut
    ? 'timeout'
    : result.exitCode === 0
      ? 'ok'
      : 'failed';

  const entry = {
    action,
    status,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  };
  appendRun(entry);
  logger[status === 'ok' ? 'info' : 'error'](entry, 'action finished');
  return entry;
}

export function startScheduler(logger) {
  const loginJob = cron.schedule(
    LOGIN_CRON,
    () => fire('login', logger).catch((err) => logger.error({ err }, 'login job error')),
    { timezone: TZ },
  );

  const logoutJob = cron.schedule(
    LOGOUT_CRON,
    () => fire('logout', logger).catch((err) => logger.error({ err }, 'logout job error')),
    { timezone: TZ },
  );

  logger.info(
    { tz: TZ, loginCron: LOGIN_CRON, logoutCron: LOGOUT_CRON },
    'scheduler started',
  );

  return {
    loginJob,
    logoutJob,
    fire: (action, opts) => fire(action, logger, opts),
    schedules: { login: LOGIN_CRON, logout: LOGOUT_CRON, tz: TZ },
  };
}
