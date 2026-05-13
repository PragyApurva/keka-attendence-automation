# keka-scheduler

Standalone Node.js service that auto punch-in / punch-outs of Keka attendance.

- Login at **09:30 IST**, Mon–Fri
- Logout at **20:00 IST**, Mon–Fri
- Skips Indian national holidays (`src/holidays.js`)

Self-contained — drives a headless Chromium via Playwright. No Python dependency.

## Setup

```bash
npm install
npx playwright install chromium

cp .env.example .env  # tweak KEKA_SUBDOMAIN, PORT if needed

# One-time interactive Google sign-in — opens a real browser window:
npm run setup-session
```

The session is persisted at `~/.workctl/chromium_profile`. As long as Google
keeps the session alive, all subsequent runs are headless.

## Run

```bash
npm start
# or persist with pm2:
pm2 start npm --name keka-scheduler -- start
pm2 save
pm2 startup
```

## HTTP API

| Method | Path                | Notes                                              |
|--------|---------------------|----------------------------------------------------|
| GET    | `/health`           | Uptime, schedules, today's holiday (if any)        |
| GET    | `/runs?limit=20`    | Recent runs from `~/.workctl-scheduler/runs.log`   |
| POST   | `/trigger/login`    | Manual punch-in. `?force=1` bypasses holiday guard |
| POST   | `/trigger/logout`   | Manual punch-out. `?force=1` bypasses holiday      |

## Refreshing the session

If you see runs with `status: "failed"` and stderr mentioning *session expired*,
re-run `npm run setup-session` to log in again.

## Updating holidays

Edit `src/holidays.js` and restart.

## Logs

- Process logs: stdout (pino JSON; pipe through `pino-pretty` for readable form)
- Run history: `~/.workctl-scheduler/runs.log` (append-only JSONL)
