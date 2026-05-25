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

## Deploying to Oracle Cloud Always-Free (recommended — $0/month forever)

Oracle Always-Free gives you a permanent ARM Ampere VM (up to 4 OCPU / 24 GB RAM).
Playwright's official image is multi-arch, so the same Dockerfile runs on ARM64.

```bash
# --- on your laptop ---
# 1. Bootstrap the Google session locally (headed browser):
npm run setup-session
tar -C ~/.workctl -czf /tmp/profile.tgz chromium_profile

# 2. Provision an Always-Free VM:
#    Oracle Cloud → Compute → Instances → Create
#    Shape: VM.Standard.A1.Flex (ARM, Always Free)
#    Image: Canonical Ubuntu 22.04
#    Open ingress on port 22 only (we'll tunnel HTTP via SSH)

# 3. Copy your repo + profile to the VM:
scp -r . ubuntu@<vm-ip>:~/keka-scheduler/
scp /tmp/profile.tgz ubuntu@<vm-ip>:/tmp/

# --- on the VM ---
ssh ubuntu@<vm-ip>

# 4. Install Docker (one-time):
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# 5. Restore profile into the named volume:
docker volume create keka_data
docker run --rm -v keka_data:/data -v /tmp:/tmp ubuntu:22.04 \
  bash -c 'mkdir -p /data/profile /data/runs && tar -xzf /tmp/profile.tgz -C /data/profile --strip-components=1'

# 6. Build + run:
cd ~/keka-scheduler
docker compose up -d --build

# 7. Verify:
docker compose logs --tail=20
curl -s http://localhost:3030/health
```

Container restarts on boot (`restart: unless-stopped`). To check health from your
laptop without opening a public port:

```bash
ssh -L 3030:localhost:3030 ubuntu@<vm-ip>
# then on laptop: curl localhost:3030/health
```

When the Google session expires, re-run steps 1, 3, 5 on the VM.

## Deploying to Fly.io (Docker)

```bash
# 1. Bootstrap the Google session LOCALLY first (Fly machines are headless):
npm run setup-session
#   → produces ~/.workctl/chromium_profile

# 2. Create the app + volume:
fly apps create keka-scheduler          # or edit name in fly.toml
fly volumes create keka_data --size 1 --region bom

# 3. Deploy:
fly deploy

# 4. Upload the local profile to the volume:
tar -C ~/.workctl -czf /tmp/profile.tgz chromium_profile
fly ssh sftp shell <<< 'put /tmp/profile.tgz /data/profile.tgz'
fly ssh console -C 'sh -c "mkdir -p /data/profile && tar -xzf /data/profile.tgz -C /data/profile --strip-components=1 && rm /data/profile.tgz"'

# 5. Verify:
fly ssh console -C 'curl -s localhost:3030/health'
```

Re-run steps 1 + 4 whenever the Google session expires.

## Logs

- Process logs: stdout (pino JSON; pipe through `pino-pretty` for readable form)
- Run history: `~/.workctl-scheduler/runs.log` (append-only JSONL)
- insert
