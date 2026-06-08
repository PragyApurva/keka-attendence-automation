import cron from 'node-cron';
import { runAction, tail } from './keka.js';
import { holidayName } from './holidays.js';
import { appendRun } from './state.js';
import { getClockStatus, setClockStatus } from './redis-state.js';

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

// Login: 9:30 AM–1:00 PM IST, only if not already clocked in
// Logout: 7:45 PM–10:30 PM IST, only if currently clocked in (Redis status === 'in')
export function shouldFire(action, parts, clockStatus) {
  if (action === 'login') {
    const afterOpen = parts.hour > 9 || (parts.hour === 9 && parts.minute >= 30);
    const beforeCutoff = parts.hour < 13;
    return afterOpen && beforeCutoff && clockStatus !== 'in';
  }
  if (action === 'logout') {
    const afterOpen = parts.hour > 19 || (parts.hour === 19 && parts.minute >= 45);
    const beforeCutoff = parts.hour < 22 || (parts.hour === 22 && parts.minute <= 30);
    return afterOpen && beforeCutoff && clockStatus === 'in';
  }
  return false;
}

export async function fireAction(action, logger, { force = false } = {}) {
  const holiday = holidayName();
  const parts = getIstDateParts();

  if (holiday && !force) {
    const entry = { action, status: 'skipped', reason: `holiday:${holiday}` };
    appendRun(entry);
    logger.info(entry, 'skipped due to holiday');
    return entry;
  }

  const clockStatus = force ? null : await getClockStatus(parts.date);

  if (!force && !shouldFire(action, parts, clockStatus)) {
    let reason, msg;
    if (action === 'login' && clockStatus === 'in') {
      reason = 'already_clocked_in';
      msg = 'skipped: already clocked in today';
    } else if (action === 'logout' && clockStatus !== 'in') {
      reason = 'already_clocked_out';
      msg = `skipped: cannot clock out — current status is ${clockStatus ?? 'not clocked in'}`;
    } else {
      reason = 'outside_window';
      msg = 'skipped: current IST time is outside punch window';
    }
    const entry = { action, status: 'skipped', reason, time: parts, clockStatus };
    appendRun(entry);
    logger.info(entry, msg);
    return entry;
  }

  logger.info({ action, time: parts, clockStatus }, 'firing keka action');
  const result = await runAction(action, { logger });
  const status = result.timedOut
    ? 'timeout'
    : result.exitCode === 0
      ? 'ok'
      : 'failed';

  if (status === 'ok') {
    const newStatus = action === 'login' ? 'in' : 'out';
    await setClockStatus(parts.date, newStatus).catch((err) =>
      logger.error({ err }, 'failed to update redis clock status'),
    );
    logger.info({ clockStatus: newStatus }, 'redis clock status updated');
  }

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
    () => fireAction('login', logger).catch((err) => logger.error({ err }, 'login job error')),
    { timezone: TZ },
  );

  const logoutJob = cron.schedule(
    LOGOUT_CRON,
    () => fireAction('logout', logger).catch((err) => logger.error({ err }, 'logout job error')),
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
