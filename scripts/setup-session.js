#!/usr/bin/env node
// One-time interactive bootstrap: opens a headed Chromium against Keka so the
// user can complete Google OAuth. The persistent profile stores cookies and
// localStorage at ~/.workctl/chromium_profile so subsequent headless runs work.
import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { chromium } from 'playwright';

const PROFILE_DIR = path.join(os.homedir(), '.workctl', 'chromium_profile');
const KEKA_URL = `https://${process.env.KEKA_SUBDOMAIN || 'app.keka.com'}`;

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const page = await ctx.newPage();
await page.goto(KEKA_URL);
console.log('Complete the Google sign-in in the browser window.');
await prompt('Press Enter here once you see the Keka dashboard... ');
const token = await page.evaluate(() => localStorage.getItem('id_token'));
if (!token) {
  console.error('No id_token found in localStorage — sign-in not completed.');
  await ctx.close();
  process.exit(1);
}
console.log('Session saved to', PROFILE_DIR);
await ctx.close();
