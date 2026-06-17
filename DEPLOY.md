# Deployment — single VPS with Docker

Runs the whole app (Next.js + Playwright/Chromium), Postgres, automatic HTTPS
and the listing scheduler on one server. This avoids the Vercel-serverless
Chromium limitation entirely (see `ROADMAP.md`, Phase A).

## What runs

| Service | Image | Role |
|---|---|---|
| `app` | built from `Dockerfile` | Next.js app + Playwright Chromium |
| `postgres` | postgres:16-alpine | database (named volume) |
| `caddy` | caddy:2 | reverse proxy + automatic Let's Encrypt HTTPS |
| `scheduler` | curlimages/curl | triggers `/api/scheduler/run` every `SCHEDULER_INTERVAL_SECONDS` |

## Prerequisites

- A VPS (e.g. Hetzner CX22) running Ubuntu, with Docker + Compose plugin.
- A domain whose DNS **A record points to the VPS IP** (needed for HTTPS).
- Ports 80 and 443 open.

## One-time setup

```bash
# 1. Install Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh

# 2. Get the code
git clone https://github.com/Nilomat-hub/HunterAi.git
cd HunterAi

# 3. Configure environment
cp .env.production.example .env
# generate secrets:
openssl rand -base64 32   # -> NEXTAUTH_SECRET
openssl rand -base64 32   # -> CRON_SECRET
openssl rand -base64 32   # -> ENCRYPTION_KEY
# then edit .env: set DOMAIN, NEXTAUTH_URL, APP_URL, POSTGRES_PASSWORD,
# the three secrets, and a real INITIAL_USER_PASSWORD.
nano .env

# 4. Build and start
docker compose -f docker-compose.prod.yml up -d --build
```

The `app` container runs `prisma migrate deploy` automatically on every start,
so the schema is created/updated without a manual step.

## Create the login user (once)

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run db:seed
```

This seeds the single user from `INITIAL_USER_EMAIL` / `INITIAL_USER_PASSWORD`.
Log in at `https://<DOMAIN>/login`.

## Day-to-day

```bash
# update to latest code
git pull && docker compose -f docker-compose.prod.yml up -d --build

# logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f scheduler

# manual scan trigger
docker compose -f docker-compose.prod.yml exec scheduler \
  sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/scheduler/run"'

# stop
docker compose -f docker-compose.prod.yml down
```

## Backups

The database lives in the `postgres-data` volume. Back it up regularly:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```

## Notes

- `docker-compose.yml` (Postgres only) is still used for **local development**
  (`npm run db:local:up`). This production stack is the separate
  `docker-compose.prod.yml`.
- The app container runs as the non-root `pwuser` from the Playwright image, so
  Chromium's sandbox works without `--no-sandbox`.
- Portal bot protection, CAPTCHAs and login changes can still cause scrape
  failures. These are logged as scheduler errors and must not crash the loop.
