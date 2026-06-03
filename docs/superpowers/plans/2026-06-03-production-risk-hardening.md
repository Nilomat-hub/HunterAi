# Production Risk Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden scheduler processing, listing idempotency, Playwright/runtime reporting, manual-send safety, and Vercel cron defaults while preserving dry-run auto mode.

**Architecture:** Add small pure helper modules for testable safety and portal heuristics, then wire them into existing actions and extraction code. Keep scheduler aggregation in the route and isolation/idempotency in `lib/listings/pipeline.ts`, avoiding schema migrations unless verification exposes a hard requirement.

**Tech Stack:** Next.js App Router, TypeScript, Prisma Client/Postgres, Playwright, `node:test` via `tsx`, ESLint, Vercel Cron.

---

## File Structure

- Create: `lib/portals/heuristics.ts` for pure listing-page and contact-person heuristics.
- Create: `lib/actions/application-safety.ts` for pure direct-send input validation.
- Modify: `lib/portals/common.ts` to use `heuristics.ts` and improve browser launch errors.
- Modify: `lib/external-applications/immobilie1.ts` to use validated direct-send values and clearer browser errors.
- Modify: `lib/external-applications/immomio.ts` only for clearer browser errors and to keep preparation non-submit by default.
- Modify: `lib/actions/applications.ts` to enforce manual direct-send validation and prevent external-flow submit from approval.
- Modify: `lib/listings/pipeline.ts` to return structured scan summaries, isolate failures, and handle Prisma unique races.
- Modify: `app/api/scheduler/run/route.ts` to aggregate scan summaries per user.
- Modify: `vercel.json` to use a Hobby-compatible daily cron.
- Modify: `GITHUB_VERCEL_SETUP.md` to document cron idempotency, Pro interval, Playwright/Vercel risk, and production acceptance tasks.
- Test: `tests/portal-heuristics.test.ts`.
- Test: `tests/application-safety.test.ts`.

### Task 1: Establish Baseline and Protect Working Tree

**Files:**
- Read: working tree only

- [ ] **Step 1: Check current status**

Run:

```bash
git status --short
```

Expected: status may include `lib/portals/common.ts`, `package-lock.json`, QA artifacts, and `tests/`.

- [ ] **Step 2: Inspect existing diffs before edits**

Run:

```bash
git diff -- lib/portals/common.ts package-lock.json
```

Expected: `lib/portals/common.ts` may already contain unavailable-listing detection; `package-lock.json` may contain only platform/npm metadata drift.

- [ ] **Step 3: Do not commit QA artifacts**

During all later `git add` steps, stage only files explicitly modified for this plan. Do not stage `.codex-dev.pid`, `.venv/`, `qa-codex-*.png`, `qa-current-*.png`, or `qa-codex-browser-report.json`.

### Task 2: Add Portal Heuristic Helpers

**Files:**
- Create: `lib/portals/heuristics.ts`
- Test: `tests/portal-heuristics.test.ts`
- Modify: `lib/portals/common.ts`

- [ ] **Step 1: Run the current heuristic tests to verify red**

Run:

```bash
npx tsx --test tests/portal-heuristics.test.ts
```

Expected: FAIL with `Cannot find module '../lib/portals/heuristics'`. If the sandbox blocks `/tmp/tsx-*` IPC with `EPERM`, rerun the same command with escalation.

- [ ] **Step 2: Create `lib/portals/heuristics.ts`**

Add:

```ts
export type ContactPerson = {
  salutation?: string;
  name: string;
};

type ListingPageSignal = {
  title?: string;
  description?: string;
  allText: string;
  links: Array<{ text: string; href: string }>;
};

const unavailablePatterns = [
  /die immobilie,? die sie suchen,? ist leider nicht mehr verf(?:ü|ue)gbar/i,
  /das inserat ist leider nicht mehr verf(?:ü|ue)gbar/i,
  /diese anzeige ist leider nicht mehr verf(?:ü|ue)gbar/i,
  /dieses angebot wurde bereits deaktiviert/i,
  /anzeige wurde deaktiviert/i,
  /inserat wurde deaktiviert/i,
  /objekt ist nicht mehr verf(?:ü|ue)gbar/i,
  /angebot ist nicht mehr verf(?:ü|ue)gbar/i
];

const searchPagePatterns = [
  /\bsuchergebnisse\b/i,
  /\bfilter\b.*\bsortieren\b/i,
  /\bwohnungen zur miete\b.*\bfilter\b/i,
  /\b\d+[\.,]?\d*\s+wohnungen zur miete\b/i
];

const listingSignals = [
  /\bwarmmiete\b/i,
  /\bkaltmiete\b/i,
  /\bgesamtmiete\b/i,
  /\bzimmer\b/i,
  /\b(?:m²|m2|qm)\b/i,
  /\banbieter kontaktieren\b/i,
  /\bexpos(?:é|e)\b/i
];

const companyWords = [
  "Immobilien",
  "Vertrieb",
  "GmbH",
  "AG",
  "KG",
  "UG",
  "Anbieter",
  "Kontaktieren",
  "Details",
  "Wohnung",
  "Kontakt",
  "Informationen",
  "Team"
];

export function isUnavailableListingPage(text: string) {
  const normalized = normalizeWhitespace(text);
  return unavailablePatterns.some((pattern) => pattern.test(normalized));
}

export function looksLikeListingPage(signal: ListingPageSignal) {
  const title = normalizeWhitespace(signal.title ?? "");
  const combined = normalizeWhitespace(`${signal.title ?? ""} ${signal.description ?? ""} ${signal.allText}`);
  if (isUnavailableListingPage(combined)) return false;

  const looksLikeSearch = searchPagePatterns.some((pattern) => pattern.test(combined));
  const signalCount = listingSignals.filter((pattern) => pattern.test(combined)).length;
  const hasApplicationLink = signal.links.some((link) => /bewerben|kontakt|expos/i.test(`${link.text} ${link.href}`));
  const titleLooksSearch = /\bsuche\b|\bsuchergebnisse\b|immobilienportal/i.test(title);

  if (looksLikeSearch && signalCount < 2 && !hasApplicationLink) return false;
  if (titleLooksSearch && signalCount < 2) return false;

  return signalCount > 0 || hasApplicationLink;
}

export function extractContactPerson(text: string): ContactPerson | undefined {
  const normalized = normalizeWhitespace(text);
  const patterns = [
    /\bAnsprechpartner(?:in)?[:\s]+(?:(Frau|Herr)\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+){1,2})\b/i,
    /\bKontaktperson[:\s]+(?:(Frau|Herr)\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+){1,2})\b/i,
    /\b(Frau|Herr)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+)\b(?=.{0,80}\b(?:Ansprechpartner|Kontaktperson|Kontakt)\b)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const salutation = match[1]?.trim();
    const name = cleanContactName(match[2]);
    if (name && isPlausibleContactName(name)) {
      return { salutation, name };
    }
  }

  return undefined;
}

function cleanContactName(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/\b(?:Kontakt|Kontaktieren|Anbieter|Details|Telefon|E-Mail|Email)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleContactName(name: string) {
  const parts = name.split(/\s+/);
  return (
    name.length <= 80 &&
    parts.length >= 2 &&
    parts.length <= 3 &&
    !companyWords.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(name))
  );
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 3: Wire helpers into `lib/portals/common.ts`**

Replace local `isUnavailableListingPage`, `extractContactPerson`, `cleanContactName`, and `isPlausibleContactName` functions with imports:

```ts
import { extractContactPerson, isUnavailableListingPage, looksLikeListingPage } from "@/lib/portals/heuristics";
```

After page evaluation and before parsing JSON-LD, use:

```ts
    if (isUnavailableListingPage(data.allText) || !looksLikeListingPage(data)) {
      throw new Error("Dieses Inserat ist nicht mehr verfügbar oder keine gültige Inseratsseite.");
    }
```

- [ ] **Step 4: Run heuristic tests**

Run:

```bash
npx tsx --test tests/portal-heuristics.test.ts
```

Expected: PASS.

### Task 3: Add Direct Immobilie1 Send Validation

**Files:**
- Create: `lib/actions/application-safety.ts`
- Test: `tests/application-safety.test.ts`
- Modify: `lib/external-applications/immobilie1.ts`
- Modify: `lib/actions/applications.ts`

- [ ] **Step 1: Run current application safety tests to verify red**

Run:

```bash
npx tsx --test tests/application-safety.test.ts
```

Expected: FAIL with `Cannot find module '../lib/actions/application-safety'`. If the sandbox blocks `/tmp/tsx-*` IPC with `EPERM`, rerun with escalation.

- [ ] **Step 2: Create `lib/actions/application-safety.ts`**

Add:

```ts
type DirectImmobilie1SendInput = {
  firstName?: string | null;
  lastName?: string | null;
  contactEmail?: string | null;
  loginEmail?: string | null;
  salutation?: string | null;
  message?: string | null;
};

type DirectImmobilie1SendValidation =
  | {
      ok: true;
      values: {
        fullName: string;
        contactEmail: string;
        salutation: string;
        message: string;
      };
    }
  | {
      ok: false;
      reasons: string[];
    };

export function validateDirectImmobilie1SendInput(input: DirectImmobilie1SendInput): DirectImmobilie1SendValidation {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const contactEmail = clean(input.contactEmail);
  const salutation = clean(input.salutation);
  const message = clean(input.message);
  const reasons: string[] = [];

  if (!firstName || !lastName) reasons.push("Vollstaendiger Name fehlt.");
  if (!contactEmail) reasons.push("Kontakt-E-Mail fehlt.");
  if (!salutation) reasons.push("Anrede fehlt.");
  if (!message || message.length < 20) reasons.push("Anschreiben fehlt oder ist zu kurz.");

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    values: {
      fullName: `${firstName} ${lastName}`,
      contactEmail,
      salutation,
      message
    }
  };
}

function clean(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}
```

- [ ] **Step 3: Run validation test**

Run:

```bash
npx tsx --test tests/application-safety.test.ts
```

Expected: PASS.

- [ ] **Step 4: Update `lib/external-applications/immobilie1.ts` to accept validated values**

Import the validator type by deriving from function result locally or define a local `ValidatedImmobilie1Contact` type:

```ts
type ValidatedImmobilie1Contact = {
  fullName: string;
  contactEmail: string;
  salutation: string;
  message: string;
};

type Immobilie1ContactInput = {
  application: Application & { listing: Listing };
  user: User;
  contact: ValidatedImmobilie1Contact;
};
```

Change `fillContactForm` to use `contact` instead of fallback values:

```ts
async function fillContactForm(page: Page, contact: ValidatedImmobilie1Contact, user: User) {
  await chooseSalutation(page, contact.salutation);
  await page.locator("#contact_name").fill(contact.fullName, { timeout: 5000 });
  await page.locator("#contact_email").fill(contact.contactEmail, { timeout: 5000 });
  if (user.phone) {
    await page.locator("#contact_phone").fill(user.phone, { timeout: 5000 }).catch(() => undefined);
  }
  await page.locator("#contact_message").fill(contact.message, { timeout: 5000 });
}
```

Call it with:

```ts
await fillContactForm(page, contact, user);
```

- [ ] **Step 5: Update `lib/actions/applications.ts` to validate before browser submit**

Import:

```ts
import { validateDirectImmobilie1SendInput } from "@/lib/actions/application-safety";
```

Inside the direct Immobilie1 branch, before `submitImmobilie1ContactApplication`, validate:

```ts
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const message = application.editedMessage ?? application.message;
    const validation = validateDirectImmobilie1SendInput({
      firstName: user.firstName,
      lastName: user.lastName,
      contactEmail: user.contactEmail,
      loginEmail: user.email,
      salutation: user.salutation,
      message
    });

    if (!validation.ok) {
      const note = `Direkter Immobilie1-Versand blockiert: ${validation.reasons.join(" ")}`;
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status: "FAILED",
          externalStatus: note,
          errorMessage: note
        }
      });
      return;
    }

    const result = await submitImmobilie1ContactApplication({
      application,
      user,
      contact: validation.values
    });
```

- [ ] **Step 6: Make approval external-flow safe**

In `approveApplication`, keep direct submit only for `Portal.IMMOBILIE1 && !application.listing.applicationUrl`. All other flows should only mark `APPROVED` and log "manual approval", without calling `prepareImmomioApplication` with `submit: true`.

Delete the submit-capable external branch from `submitImmobilie1Application` after the `if (!application.listing.applicationUrl)` block, because this helper should only submit direct contact forms.

- [ ] **Step 7: Update ambiguous log/status text**

Change direct manual send logs from "automatisch abgeschickt" to manual wording:

```ts
message: "Immobilie1-Kontaktanfrage wurde nach manueller Freigabe abgeschickt.",
```

Use status text:

```ts
externalStatus: "Manuell freigegeben. Direkte Immobilie1-Kontaktanfrage wird abgeschickt.",
```

### Task 4: Improve Playwright Runtime Errors

**Files:**
- Modify: `lib/portals/common.ts`
- Modify: `lib/external-applications/immobilie1.ts`
- Modify: `lib/external-applications/immomio.ts`

- [ ] **Step 1: Add a shared local browser-launch wrapper in each Playwright file**

In each file, replace direct `chromium.launch({ ... })` with a helper:

```ts
async function launchChromium(context: string) {
  try {
    return await chromium.launch({
      headless: true,
      executablePath: getLocalChromiumPath()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Chromium-Startfehler";
    throw new Error(
      `${context}: Chromium konnte nicht gestartet werden. Playwright auf Vercel ist nicht automatisch garantiert; pruefe Browser-Binary, Sandbox, Speicher, Laufzeit oder PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Ursache: ${message}`
    );
  }
}
```

In `immobilie1.ts`, keep the viewport creation after launch:

```ts
const browser = await launchChromium("Immobilie1-Kontaktformular");
```

In `immomio.ts`:

```ts
const browser = await launchChromium("Immomio-Bewerbungsvorbereitung");
```

In `common.ts`:

```ts
const browser = await launchChromium("Portal-Inseratsextraktion");
```

- [ ] **Step 2: Confirm no secret values are logged**

Search:

```bash
rg -n "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH|DATABASE_URL|OPENAI_API_KEY|TELEGRAM_BOT_TOKEN|ENCRYPTION_KEY" lib app
```

Expected: only variable names may appear in error messages; actual values must not be interpolated.

### Task 5: Harden Pipeline Idempotency and Error Isolation

**Files:**
- Modify: `lib/listings/pipeline.ts`

- [ ] **Step 1: Add summary types**

Near imports in `lib/listings/pipeline.ts`, add:

```ts
type ScheduledScanError = {
  userId: string;
  profileId?: string;
  adapter?: string;
  listingUrl?: string;
  message: string;
};

export type ScheduledScanSummary = {
  userId: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ScheduledScanError[];
};

type PersistListingResult = {
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>;
  action: "created" | "updated" | "skipped";
};
```

If the `PersistListingResult` type is awkward with Prisma inference, use:

```ts
type PersistListingResult = {
  listingId: string;
  action: "created" | "updated" | "skipped";
};
```

and keep `processManualListing` returning the listing by loading it after persistence.

- [ ] **Step 2: Replace `runScheduledScan` loop with isolated summary aggregation**

Use this shape:

```ts
export async function runScheduledScan(userId: string): Promise<ScheduledScanSummary> {
  const summary: ScheduledScanSummary = {
    userId,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  let profiles: SearchProfile[] = [];
  try {
    profiles = await prisma.searchProfile.findMany({
      where: { userId, active: true }
    });
  } catch (error) {
    await recordScanError(summary, { userId, message: safeErrorMessage(error) });
    return summary;
  }

  for (const profile of profiles) {
    for (const adapter of portalAdapters) {
      let extractedListings: PortalListing[] = [];
      try {
        extractedListings = (await adapter.searchListings?.(profile.id)) ?? [];
      } catch (error) {
        await recordScanError(summary, {
          userId,
          profileId: profile.id,
          adapter: adapter.portal,
          message: safeErrorMessage(error)
        });
        continue;
      }

      for (const extracted of extractedListings) {
        summary.processed += 1;
        try {
          const result = await persistListing(userId, extracted, profile);
          summary[result.action] += 1;
        } catch (error) {
          await recordScanError(summary, {
            userId,
            profileId: profile.id,
            adapter: adapter.portal,
            listingUrl: extracted.url,
            message: safeErrorMessage(error)
          });
        }
      }
    }
  }

  return summary;
}
```

- [ ] **Step 3: Add sanitized error logging**

Add:

```ts
async function recordScanError(summary: ScheduledScanSummary, error: ScheduledScanError) {
  summary.errors.push(error);
  console.error("scheduler.scan_error", error);

  await prisma.telegramLog
    .create({
      data: {
        userId: error.userId,
        type: "ERROR",
        message: `Scheduler-Fehler: ${error.message}`,
        payload: {
          profileId: error.profileId,
          adapter: error.adapter,
          listingUrl: error.listingUrl
        }
      }
    })
    .catch((logError) => {
      console.error("scheduler.scan_error_log_failed", {
        userId: error.userId,
        message: safeErrorMessage(logError)
      });
    });
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(token|secret|password|key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}
```

- [ ] **Step 4: Make listing persistence race-safe**

In `persistListing`, when `listing.create` throws `P2002`, load and update the existing listing:

```ts
  let listing;
  try {
    listing = await prisma.listing.create({ data: { /* existing data */ } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.listing.findUnique({
        where: { userId_normalizedUrl: { userId, normalizedUrl } }
      });
      if (raced) {
        const updated = await updateExistingListingFromExtraction(raced.id, extracted);
        return { listing: updated, action: updated.updatedAt > raced.updatedAt ? "updated" : "skipped" };
      }
    }
    throw error;
  }
```

Add:

```ts
function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
```

If TypeScript comparison of `updatedAt` is noisy, return `"skipped"` for the race path after updating safe fields. The important property is no duplicate application and no duplicate notification.

- [ ] **Step 5: Extract existing-listing update**

Add:

```ts
async function updateExistingListingFromExtraction(listingId: string, extracted: PortalListing) {
  if (!extracted.applicationUrl) {
    return prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
  }

  return prisma.listing.update({
    where: { id: listingId },
    data: {
      applicationUrl: extracted.applicationUrl,
      contactMethod: "EXTERNAL",
      rawData: extracted.rawData
    }
  });
}
```

Use it in the existing-listing branch. Return `{ listing, action: "updated" }` when `applicationUrl` changed and `{ listing, action: "skipped" }` otherwise.

- [ ] **Step 6: Avoid duplicate applications/notifications**

After creating a non-duplicate listing and before `generateApplicationMessage`, check:

```ts
  const existingApplication = await prisma.application.findFirst({
    where: { userId, listingId: listing.id },
    select: { id: true }
  });
  if (existingApplication) {
    return { listing, action: "skipped" };
  }
```

Then create the application, update listing status, send Telegram, and evaluate auto dry-run as before.

- [ ] **Step 7: Preserve manual API shape**

If `persistListing` now returns a result wrapper, update `processManualListing`:

```ts
export async function processManualListing(userId: string, url: string) {
  const adapter = getAdapterForUrl(url);
  const extracted = await adapter.extractListing(url);
  const profile = await findBestProfileForListing(userId, extracted);
  const result = await persistListing(userId, extracted, profile);
  return result.listing;
}
```

### Task 6: Aggregate Scheduler Route Results

**Files:**
- Modify: `app/api/scheduler/run/route.ts`

- [ ] **Step 1: Replace serial result array with summary aggregation**

Use:

```ts
  const summaries = [];
  for (const user of users) {
    try {
      summaries.push(await runScheduledScan(user.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Scheduler-Fehler";
      console.error("scheduler.user_failed", { userId: user.id, message });
      summaries.push({
        userId: user.id,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ userId: user.id, message }]
      });
    }
  }

  return NextResponse.json({
    ok: summaries.every((summary) => summary.errors.length === 0),
    users: summaries.length,
    processed: summaries.reduce((total, summary) => total + summary.processed, 0),
    created: summaries.reduce((total, summary) => total + summary.created, 0),
    updated: summaries.reduce((total, summary) => total + summary.updated, 0),
    skipped: summaries.reduce((total, summary) => total + summary.skipped, 0),
    errors: summaries.flatMap((summary) => summary.errors)
  });
```

- [ ] **Step 2: Confirm route never sends applications**

Search:

```bash
rg -n "submitImmobilie1ContactApplication|prepareImmomioApplication|markApplicationSent|approveApplication" app/api/scheduler lib/listings
```

Expected: no submit/manual action import or call from scheduler or listing pipeline. `evaluateAutoApplyDryRun` may remain and must say dry-run.

### Task 7: Update Cron and Production Docs

**Files:**
- Modify: `vercel.json`
- Modify: `GITHUB_VERCEL_SETUP.md`
- Optionally modify: `.env.example`

- [x] **Step 1: Change default cron schedule**

In `vercel.json`, replace:

```json
"schedule": "*/30 * * * *"
```

with:

```json
"schedule": "0 6 * * *"
```

- [x] **Step 2: Update scheduler docs**

In `GITHUB_VERCEL_SETUP.md`, replace the Vercel Cron section with:

```md
## Vercel Cron Scheduler

`vercel.json` defaults to one run per day at 06:00 UTC:

- Pfad: `/api/scheduler/run`
- Methode: `GET`
- Secret: `CRON_SECRET` als Vercel Environment Variable

Der Tagesrhythmus ist absichtlich Hobby-kompatibel. Auf Vercel Pro kann der Zeitplan nach einem Live-Test z. B. auf `*/30 * * * *` geaendert werden.

Vercel Cron kann doppelte oder parallele Invocations liefern. Der Scheduler und die Listing-Persistenz muessen deshalb idempotent bleiben: gleiche URL pro User darf keine zweite Listing-Zeile, keine zweite Application und keine zweite Telegram-Benachrichtigung erzeugen.

Cron fuehrt keine echten Bewerbungen aus. Auto-Modus ist ein Dry-Run und darf nur protokollieren, was gesendet wuerde.
```

- [x] **Step 3: Add Playwright/Vercel production note**

Append:

```md
## Playwright in Produktion

Die App startet Chromium aktuell direkt ueber Playwright. Der lokale Fallback `.playwright-runtime/chromium-1223/chrome-win64/chrome.exe` ist Windows-spezifisch und beweist nicht, dass Chromium auf Vercel verfuegbar ist.

Vor Produktionsbetrieb muss live entschieden und getestet werden:

- Playwright Chromium auf Vercel installieren und Start, Sandbox, Speicher und Funktionslaufzeit pruefen,
- Browser-Automation in einen separaten Worker auslagern,
- oder einen Managed-Browser-Dienst wie Browserless nutzen.

Portal-Bot-Schutz, Captchas, Login-Aenderungen und Timeouts koennen trotzdem auftreten. Solche Fehler duerfen Cron-Laeufe nicht abbrechen; sie werden als Scheduler-Fehler protokolliert.
```

- [x] **Step 4: Add acceptance checklist**

Append:

```md
## Produktionsabnahme

Nicht als voll production-ready einstufen, bevor diese Punkte mit der echten Umgebung geprueft sind:

- Neon-Datenbankverbindung,
- Vercel Environment Secrets,
- Migration gegen die Produktionsdatenbank,
- Preview Deployment,
- Login von einem externen Geraet,
- Vercel-Cron-Test,
- Telegram-Versand aus Produktion,
- Playwright/Vercel- oder Browserless/Worker-Entscheidung.
```

### Task 8: Focused Verification

**Files:**
- Read/execute only

- [ ] **Step 1: Run helper tests**

Run:

```bash
npx tsx --test tests/portal-heuristics.test.ts tests/application-safety.test.ts
```

Expected: all tests pass. If the sandbox blocks `/tmp/tsx-*` IPC with `EPERM`, rerun with escalation and report that escalation was required.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: exit code 0. Prisma may warn that `package.json#prisma` is deprecated; treat that as optional unless a safe cleanup is explicitly requested.

- [ ] **Step 4: Re-check working tree**

Run:

```bash
git status --short
```

Expected: only intended source/docs/test files are modified or added, plus any pre-existing QA artifacts and the pre-existing `package-lock.json` drift. Do not stage QA artifacts.

## Self-Review

Spec coverage:

- Scheduler isolation and useful summary: Task 5 and Task 6.
- Prisma unique race handling and no duplicate application/notification: Task 5.
- Hobby-compatible Vercel cron and idempotency docs: Task 7.
- Playwright/Vercel honesty and clearer runtime errors: Task 4 and Task 7.
- Manual-only direct Immobilie1 sending and external-flow safety: Task 3.
- Contact person and unavailable/non-listing heuristics: Task 2.
- Working tree hygiene: Task 1 and Task 8.
- Verification: Task 8.

Placeholder scan: no deferred placeholders are intentionally left in implementation steps.

Type consistency: helper names match the tests already present in `tests/`, and the pipeline route contract is consistently named `ScheduledScanSummary`.
