import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = path.join(os.homedir(), '.workctl-scheduler');
const LOG_FILE = path.join(LOG_DIR, 'runs.log');

function ensureDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function appendRun(entry) {
  ensureDir();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

export function recentRuns(limit = 20) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const data = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = data.split('\n').filter(Boolean);
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l, parseError: true };
      }
    })
    .reverse();
}

export const LOG_PATH = LOG_FILE;
