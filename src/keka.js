import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium } from 'playwright';

const PROFILE_DIR = path.join(os.homedir(), '.workctl', 'chromium_profile');
const ACTION_TIMEOUT_MS = 5 * 60 * 1000;

function kekaBaseUrl() {
  const sub = process.env.KEKA_SUBDOMAIN || 'app.keka.com';
  return `https://${sub}`;
}

function ensureProfileDir() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

function profileHasSession() {
  // Playwright Chromium puts cookies under <profile>/Default/Cookies (or Network/Cookies).
  return (
    fs.existsSync(path.join(PROFILE_DIR, 'Default', 'Cookies')) ||
    fs.existsSync(path.join(PROFILE_DIR, 'Default', 'Network', 'Cookies'))
  );
}

async function openContext({ headless }) {
  ensureProfileDir();
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
}

async function isLoggedIn(page) {
  try {
    const token = await page.evaluate(() => localStorage.getItem('id_token'));
    return Boolean(token);
  } catch {
    return false;
  }
}

async function clickIfPresent(page, selector, { timeout = 5000 } = {}) {
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`action timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function performLogin(logger) {
  if (!profileHasSession()) {
    throw new Error(
      'No saved Chromium profile session. Run a manual headed login first ' +
        '(set HEADED=1 and call /trigger/login, or use the workctl Python CLI) ' +
        'to complete Google OAuth.',
    );
  }

  const headless = process.env.HEADED !== '1';
  const context = await openContext({ headless });
  try {
    const page = await context.newPage();
    await page.goto(kekaBaseUrl(), { waitUntil: 'networkidle', timeout: 30_000 });

    if (!(await isLoggedIn(page))) {
      throw new Error(
        'Keka session expired — Google OAuth required. Run with HEADED=1 to refresh.',
      );
    }

    const clicked = await clickIfPresent(page, "button:has-text('Web Clock-In')");
    if (!clicked) {
      logger.warn('Web Clock-In button not found — likely already clocked in');
      return { punched: false, reason: 'no-clock-in-button' };
    }
    await clickIfPresent(page, "button.btn-primary.btn-sm:has-text('Confirm')");
    await page.waitForLoadState('networkidle').catch(() => {});
    return { punched: true };
  } finally {
    await context.close();
  }
}

async function performLogout(logger) {
  if (!profileHasSession()) {
    throw new Error('No saved Chromium profile session.');
  }

  const headless = process.env.HEADED !== '1';
  const context = await openContext({ headless });
  try {
    const page = await context.newPage();
    await page.goto(kekaBaseUrl(), { waitUntil: 'networkidle', timeout: 30_000 });

    // Mirror the Python flow: two Clock-out buttons then Confirm.
    const c1 = await clickIfPresent(page, "button.btn-danger.btn-x-sm:has-text('Clock-out')");
    const c2 = await clickIfPresent(page, "button.btn-danger.btn-x-sm.mr-10:has-text('Clock-out')");
    const ok = await clickIfPresent(page, "button.btn-primary.btn-sm:has-text('Confirm')");

    if (!c1 && !c2 && !ok) {
      logger.warn('Clock-out buttons not found — likely already clocked out');
      return { punched: false, reason: 'no-clock-out-button' };
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    return { punched: true };
  } finally {
    await context.close();
  }
}

export async function runAction(action, { logger } = {}) {
  if (action !== 'login' && action !== 'logout') {
    throw new Error(`invalid action: ${action}`);
  }

  const startedAt = Date.now();
  let timedOut = false;

  try {
    const work = action === 'login' ? performLogin(logger) : performLogout(logger);
    const result = await withTimeout(work, ACTION_TIMEOUT_MS, () => {
      timedOut = true;
    });
    return {
      exitCode: 0,
      stdout: JSON.stringify(result),
      stderr: '',
      durationMs: Date.now() - startedAt,
      timedOut: false,
    };
  } catch (err) {
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
