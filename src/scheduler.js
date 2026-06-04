import cron from 'node-cron';
import { runAction, tail } from './keka.js';
import { holidayName } from './holidays.js';
import { appendRun, recentRuns } from './state.js';

const TZ = process.env.TZ_NAME || 'Asia/Kolkata';

const LOGIN_CRON = '*/15 * * * 1-5';
const LOGOUT_CRON = '*/15 * * * 1-5';

export function getIstDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function isInPunchWindow(action, parts) {
  if (action === 'login') {
    return parts.hour === 9 && parts.minute >= 25 && parts.minute <= 35;
  }

  if (action === 'logout') {
    return parts.hour === 20 && parts.minute >= 25 && parts.minute <= 35;
  }

  return false;
}

function hasSuccessfulRunToday(action, date) {
  return recentRuns(200).some(
    (run) => run.action === action && run.status === 'ok' && run.ts?.startsWith(date),
  );
}

export async function fireAction(action, logger, { force = false } = {}) {
  const holiday = holidayName();
  const parts = getIstDateParts();
  const alreadyPunched = hasSuccessfulRunToday(action, parts.date);

  if (holiday && !force) {
    const entry = { action, status: 'skipped', reason: `holiday:${holiday}` };
    appendRun(entry);
    logger.info(entry, 'skipped due to holiday');
    return entry;
  }

  if (!force && !isInPunchWindow(action, parts)) {
    const entry = { action, status: 'skipped', reason: 'out-of-window', time: parts };
    appendRun(entry);
    logger.info(entry, 'skipped because current IST time is outside punch window');
    return entry;
  }

  if (!force && alreadyPunched) {
    const entry = { action, status: 'skipped', reason: 'already_punched', date: parts.date };
    appendRun(entry);
    logger.info(entry, 'skipped because action already succeeded today');
    return entry;
  }

  logger.info({ action, time: parts }, 'firing keka action');
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
  const level = status === 'ok' || status === 'skipped' ? 'info' : 'error';
  logger[level](entry, 'action finished');
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
    fire: (action, opts) => fireAction(action, logger, opts),
    schedules: { login: LOGIN_CRON, logout: LOGOUT_CRON, tz: TZ },
  };
}
