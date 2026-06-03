# Production Risk Hardening Design

Date: 2026-06-03

## Goal

Fix the critical production risks from the skeptical review without changing the product boundary: scheduler scans stay dry-run only, manual approval may submit direct Immobilie1 contact forms, and external/Immomio flows remain manually prepared instead of blindly submitted.

## Current Context

HunterAi is a Next.js app with Prisma/Postgres, Playwright-based listing extraction, Telegram notifications, OpenAI-generated application drafts, and a Vercel Cron endpoint at `/api/scheduler/run`.

Relevant current behavior:

- `app/api/scheduler/run/route.ts` loads scheduler-enabled users and calls `runScheduledScan(user.id)` serially.
- `lib/listings/pipeline.ts` scans active profiles and portal adapters, persists listings, generates one application draft, sends Telegram notifications, and evaluates auto mode as a dry-run.
- `persistListing` checks `findUnique` and later calls `listing.create`, which can race against duplicate cron invocations because `Listing` has `@@unique([userId, normalizedUrl])`.
- `lib/portals/common.ts`, `lib/external-applications/immobilie1.ts`, and `lib/external-applications/immomio.ts` launch local Playwright Chromium directly.
- `approveApplication` can really submit direct Immobilie1 forms when there is no external `applicationUrl`.
- The working tree already contains user or QA changes: `lib/portals/common.ts`, `package-lock.json`, untracked QA artifacts, and untracked tests.

## Design

### Scheduler and Pipeline Resilience

The scheduler route should become a summary aggregator. The pipeline should own per-user/profile/adapter/listing isolation so a single portal timeout, extraction issue, database race, Telegram failure, or application-generation failure cannot abort the whole cron run.

`runScheduledScan(userId)` will return a structured summary:

- `processed`: number of extracted listing candidates attempted.
- `created`: listings newly created.
- `updated`: existing listings updated.
- `skipped`: duplicate or already-known listings that did not trigger new notifications.
- `errors`: sanitized error records with `userId`, optional `profileId`, optional `adapter`, optional `listingUrl`, and a safe message.

The scheduler route will catch failures per user, merge summaries, and return JSON with `ok`, `users`, `processed`, `created`, `updated`, `skipped`, and `errors`. Cron must not send real applications; it only creates draft applications, Telegram listing notices, and auto-mode dry-run logs.

### Idempotency and Race Handling

`persistListing` will handle `P2002` unique constraint errors for `userId_normalizedUrl`. If another invocation creates the listing first, the function will load the existing listing and update safe fields such as `applicationUrl`, `contactMethod`, and `rawData` when useful. It will not create a second application or Telegram notification for an existing listing.

Because the schema does not currently enforce one application per listing, the implementation will also guard application creation with an existing-application check after listing creation. A schema-level unique constraint can be considered later, but this hardening should avoid a migration unless needed.

### Vercel Cron Defaults

`vercel.json` will default to a Hobby-compatible daily schedule. Documentation will state that Pro projects can use a more frequent interval, for example `*/30 * * * *`, after the deployment is live-tested. The docs will also explicitly say Vercel can deliver duplicate or parallel cron events, so all cron work must stay idempotent.

### Playwright Runtime Honesty

The code should not pretend Vercel Playwright is guaranteed. Browser launch errors will be wrapped in clear runtime errors that mention Chromium availability and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` without leaking environment values. Extraction failures will be caught by the pipeline and recorded as scheduler errors rather than killing the cron.

Docs will state that the repo currently launches Chromium directly, the local `.playwright-runtime/.../chrome.exe` path is Windows-specific, and production needs a live decision: install/verify Playwright Chromium on Vercel, move browser automation to a worker, or use a managed browser service such as Browserless.

### Sending Safety Boundary

Only the manual approval action may submit direct Immobilie1 contact forms. External application URLs, including Immomio, must be prepared for manual review and never submitted by `approveApplication`.

Before a direct Immobilie1 send, the app will validate:

- full name from explicit first and last name,
- explicit `contactEmail`,
- salutation,
- message with minimum useful length.

The code will not silently fall back to login email for production sending. If validation fails, the application returns to `FAILED` with a clear error and no browser submit attempt.

UI and log text will distinguish manual submission from auto-mode dry-run. Auto-mode messages must say nothing was sent.

### Portal Heuristics

Contact-person extraction will move into a pure helper that is conservative:

- only accept names near explicit labels such as `Ansprechpartner`, `Ansprechpartnerin`, or `Kontaktperson`,
- allow salutation plus a plausible person name,
- reject company words, CTA text, generic provider text, and overly broad page-text matches,
- prefer `undefined` over a likely wrong contact.

Unavailable listing detection will also move into pure helpers. It will detect clear unavailable/deactivated/replacement/search pages without treating ordinary phrases such as "sofort verfügbar" as unavailable. `extractGenericListing` will reject clearly unavailable or non-listing pages before persistence.

### Working Tree Hygiene

Implementation must start with `git status --short`. Existing changes must be preserved unless the diff shows they are directly part of this fix. The current `package-lock.json` diff looks like platform/npm metadata drift, so the implementation should not expand it. QA artifacts such as `.codex-dev.pid` and `qa-codex-*.png` must not be committed blindly.

## Verification

Required verification:

- Run the focused helper tests with `npx tsx --test tests/portal-heuristics.test.ts tests/application-safety.test.ts` if those tests are kept.
- Run `npm run lint`.
- Run `npm run build`.

If a command fails due to sandbox restrictions, rerun with approval and report the exact reason.

## Remaining Production Acceptance Tasks

These fixes do not prove production readiness. Before claiming production-ready status, validate:

- Neon production database connectivity,
- Vercel environment secrets,
- Prisma migration against the production database,
- preview deployment,
- external-device login,
- Vercel Cron invocation from production,
- Telegram delivery from production,
- Playwright-on-Vercel versus Browserless/worker decision.
