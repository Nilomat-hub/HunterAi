# Project memory — HunterAi

Private, single-user apartment-hunting assistant for Germany. **Online-reachable
but single-user** (not a multi-tenant SaaS). Next.js 15 (App Router) + Prisma +
PostgreSQL + NextAuth + Playwright.

## Canonical repo / history note

This repo (`Nilomat-hub/HunterAi`) is the **canonical** project. An older
hackathon monorepo named `HHunter` (Fastify + vanilla-JS web + raw SQL, no auth)
existed separately and is **archived** — it has been superseded by this repo in
every dimension. The only thing ported from it was the **kleinanzeigen.de**
portal adapter (the one portal this repo lacked).

## Key decisions (read these before changing infra)

- **Hosting = single VPS with Docker, NOT Vercel.** Playwright/Chromium is used
  for both listing extraction and apply automation; Vercel serverless cannot run
  Chromium reliably (see `GITHUB_VERCEL_SETUP.md`). Production stack is
  `docker-compose.prod.yml` (app + postgres + Caddy auto-HTTPS + interval
  scheduler). The app container runs as the Playwright image's non-root `pwuser`
  so Chromium's sandbox works without `--no-sandbox`. See `DEPLOY.md`.
- **Approval-first (ADR 003).** No application is auto-sent without explicit user
  approval. Auto-apply is a dry-run that only logs what *would* be sent.
- **Immomio = dry-run prepare only**; immobilie1 = direct form submit (with
  validation + rate limiting). See `lib/external-applications/`.
- See `ARCHITECTURE.md` for ADRs 001–005 and `ROADMAP.md` for the shipping plan.

## Verified facts

- Installed Playwright is **1.60.0** (Dockerfile base image must match:
  `mcr.microsoft.com/playwright:v1.60.0-jammy`).
- Chromium verified launching in-container as `pwuser` without `--no-sandbox`.
- Listing intake is currently **manual-URL only**: `adapter.searchListings()`
  returns `[]` for every portal. Automatic discovery is unbuilt (Roadmap Phase D).

## Conventions

- Server Actions in `lib/actions/` for mutations; protected pages call
  `requireUserId()`. Prisma client via `lib/db/prisma.ts`.
- Portal credentials are AES-256-GCM encrypted (`lib/crypto/secrets.ts`).
- Tests run with `npx tsx --test tests/*.test.ts`. Lint: `npm run lint`.
- Adding a `Portal` enum value requires: schema.prisma + a migration
  (`ALTER TYPE "Portal" ADD VALUE '…'`) + the `Record<Portal,…>` label maps.
- Never commit `.env`, real secrets, or `*.tsbuildinfo`.

## Branch state (2026-06-17)

- `main` — baseline.
- `feat/kleinanzeigen-adapter` — kleinanzeigen.de adapter + `ROADMAP.md`
  (extraction needs a live test; bot protection).
- `feat/docker-vps` — VPS Docker deployment (verified locally).
- `docs/claude-memory` — this file.
