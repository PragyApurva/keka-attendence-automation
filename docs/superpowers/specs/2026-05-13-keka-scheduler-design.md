# Keka Auto-Punch Scheduler — Design

## Purpose

A long-running Node.js service that automatically punches the user in/out of Keka attendance:

- **Login** at 09:30 Asia/Kolkata, Mon–Fri
- **Logout** at 20:00 Asia/Kolkata, Mon–Fri
- **Skip** Indian national holidays

The Keka browser automation already exists in Python at `~/repos/personal/scripts/workctl/keka.py` (Playwright, persistent Chromium profile). This service is a thin scheduler that invokes that script — no browser code in Node.

## Architecture

```
+------------------+     cron fires      +-----------------+
|  node-cron       |  ----------------> |  keka.runAction |
|  (Asia/Kolkata)  |    (after holiday  |  spawn python   |
+------------------+     guard passes)  +-----------------+
                                                 |
                                                 v
                                  python -m workctl <login|logout>
                                  cwd = $WORKCTL_PATH
                                                 |
                                                 v
                                          run logged to JSONL
```

## Components

### `src/server.js`
HTTP server on `$PORT` (default 3030). Boots the scheduler on startup. Exposes:

- `GET /health` → `{ ok, uptime, nextLogin, nextLogout, tz }`
- `GET /runs` → last 20 entries from the JSONL run log
- `POST /trigger/login` → fires the login action immediately (for testing/manual override)
- `POST /trigger/logout` → fires the logout action immediately

### `src/scheduler.js`
Registers two `node-cron` jobs with `timezone: 'Asia/Kolkata'`:

- Login: `30 9 * * 1-5`
- Logout: `0 20 * * 1-5`

Before invoking the action, the job checks `holidays.isHoliday(today)`. If today is a holiday, it logs a `skipped` entry and returns.

### `src/keka.js`
`runAction(action: 'login' | 'logout'): Promise<{ exitCode, stdout, stderr }>`

Spawns `python3 -m workctl <action>` with `cwd = $WORKCTL_PATH`. 5-minute hard timeout (Playwright cold start + clicks should fit in ~30s, but the first run can prompt for OAuth which we treat as a failure here — manual setup is a prerequisite).

### `src/holidays.js`
Hardcoded list of Indian national holidays for the current year. `isHoliday(date)` compares against `YYYY-MM-DD` strings. Documented as needing yearly update.

2026 list (gazetted national holidays):
- Republic Day — 2026-01-26
- Holi — 2026-03-04 (approx)
- Good Friday — 2026-04-03
- Eid al-Fitr — 2026-03-21 (approx, moon-sighting)
- Independence Day — 2026-08-15
- Gandhi Jayanti — 2026-10-02
- Dussehra — 2026-10-20
- Diwali — 2026-11-08
- Guru Nanak Jayanti — 2026-11-24
- Christmas — 2026-12-25

(User can edit the list freely; it's plain data.)

### `src/state.js`
Append-only JSONL at `~/.workctl-scheduler/runs.log`. One line per scheduler firing:

```json
{"ts":"2026-05-13T04:00:00.000Z","action":"login","status":"ok","exitCode":0,"durationMs":18432}
{"ts":"2026-05-13T14:30:00.000Z","action":"logout","status":"failed","exitCode":1,"stderrTail":"..."}
{"ts":"2026-05-14T04:00:00.000Z","action":"login","status":"skipped","reason":"holiday:Republic Day"}
```

## Configuration

`.env` file:

```
WORKCTL_PATH=/home/apu/repos/personal/scripts
PYTHON_BIN=python3
PORT=3030
TZ_NAME=Asia/Kolkata
```

## Error Handling

- Subprocess non-zero exit → log entry with `status: "failed"` and stderr tail; server keeps running.
- Subprocess timeout (5 min) → kill child, log `status: "timeout"`.
- No retries. A failed punch-in is better than a double punch-in (which would be visible to HR).
- If the Python script needs a headed browser (expired Google session), the run fails — user must run `workctl login` manually once to refresh the profile.

## Testing

- Unit tests for `holidays.isHoliday`: known holiday returns true, regular Tuesday returns false, leap-year Feb 29 handled.
- Unit test for `scheduler` holiday guard: stub `runAction`, assert it is not called on a holiday date.
- Manual smoke test: `POST /trigger/login` against a real Keka session.

## Running

```
npm install
npm start          # foreground
# or
pm2 start npm --name keka-scheduler -- start
```

## Out of Scope

- Optional Slack/email notifications on failure (could add later)
- Auto-refresh of expired Google OAuth session (requires headed browser; user does manually)
- Dynamic holiday calendar (API-driven) — static list is fine for ~10 dates/year
