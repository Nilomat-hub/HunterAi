# GitHub- und Vercel-Setup

## Was nicht ins Repository darf

- `.env`
- echte API-Keys
- echte Datenbank-URLs
- Portal-Passwoerter
- Playwright-/Build-Ordner wie `.next-local`, `.tools` oder `.playwright-runtime`

Diese Dateien sind bereits in `.gitignore` abgedeckt. Vor dem Push trotzdem kurz pruefen, dass `.env` nicht gestaged ist.

## Vercel Environment Variables

In Vercel als Environment Variables setzen:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `CRON_SECRET`
- `ENCRYPTION_KEY`
- `INITIAL_USER_EMAIL`
- `INITIAL_USER_PASSWORD`
- `APP_URL`

Portal-Zugangsdaten wie Immomio gehoeren nicht in Vercel-Env. Die werden verschluesselt in der App gespeichert.

## Build und Datenbank

Vercel Build Command:

```bash
npm run build
```

Nach dem ersten Deployment die Migrationen ausfuehren:

```bash
npm run prisma:deploy
npm run db:seed
```

Lokal nutzt der Wrapper `npm-local.cmd` automatisch `.next-local`, damit OneDrive keine kaputten Next-Build-Artefakte produziert. Auf Vercel wird ohne `NEXT_DIST_DIR` der normale `.next`-Ordner genutzt.

## Vercel Cron Scheduler

`vercel.json` defaults to one run per day at 06:00 UTC:

- Pfad: `/api/scheduler/run`
- Methode: `GET`
- Secret: `CRON_SECRET` als Vercel Environment Variable

Der Tagesrhythmus ist absichtlich Hobby-kompatibel. Auf Vercel Pro kann der Zeitplan nach einem Live-Test z. B. auf `*/30 * * * *` geaendert werden.

Vercel Cron kann doppelte oder parallele Invocations liefern. Der Scheduler und die Listing-Persistenz muessen deshalb idempotent bleiben: gleiche URL pro User darf keine zweite Listing-Zeile, keine zweite Application und keine zweite Telegram-Benachrichtigung erzeugen.

Cron fuehrt keine echten Bewerbungen aus. Auto-Modus ist ein Dry-Run und darf nur protokollieren, was gesendet wuerde.

Der GitHub Workflow `.github/workflows/scheduler.yml` bleibt nur als manueller Fallback per `workflow_dispatch` erhalten. Falls du ihn nutzt, setze in GitHub `APP_URL` und `CRON_SECRET`.

## Playwright in Produktion

Die App startet Chromium aktuell direkt ueber Playwright. Der lokale Fallback `.playwright-runtime/chromium-1223/chrome-win64/chrome.exe` ist Windows-spezifisch und beweist nicht, dass Chromium auf Vercel verfuegbar ist.

Vor Produktionsbetrieb muss live entschieden und getestet werden:

- Playwright Chromium auf Vercel installieren und Start, Sandbox, Speicher und Funktionslaufzeit pruefen,
- Browser-Automation in einen separaten Worker auslagern,
- oder einen Managed-Browser-Dienst wie Browserless nutzen.

Vercel Browser-Verfuegbarkeit, Runtime, Sandbox, Speicher, Funktionslaufzeit und Portal-Bot-Schutz sind nicht garantiert. Captchas, Login-Aenderungen und Timeouts koennen ebenfalls auftreten. Solche Fehler duerfen Cron-Laeufe nicht abbrechen; sie werden als Scheduler-Fehler protokolliert.

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

## WSL-Startbefehle

Wenn du aus Ubuntu/WSL arbeitest:

```bash
cd "/mnt/c/Users/nilsv/OneDrive/Dokumente/Wohnungsuche Ai"
cmd.exe /c npm-local.cmd run dev
```

Fuer Build oder Checks:

```bash
cmd.exe /c npm-local.cmd run lint
cmd.exe /c npm-local.cmd run build
```
