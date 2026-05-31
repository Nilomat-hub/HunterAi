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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SCHEDULER_SECRET`
- `ENCRYPTION_KEY`
- `INITIAL_USER_EMAIL`
- `INITIAL_USER_PASSWORD`

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

## GitHub Actions Scheduler

Repository Secrets in GitHub setzen:

- `APP_URL`, zum Beispiel `https://deine-app.vercel.app`
- `SCHEDULER_SECRET`, identisch mit Vercel

Der Workflow `.github/workflows/scheduler.yml` ruft alle 10 Minuten `/api/scheduler/run` auf.

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
