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

Der Scheduler laeuft ueber `vercel.json` alle 30 Minuten per Vercel Cron:

- Pfad: `/api/scheduler/run`
- Methode: `GET`
- Secret: `CRON_SECRET` als Vercel Environment Variable

Der GitHub Workflow `.github/workflows/scheduler.yml` bleibt nur als manueller Fallback per `workflow_dispatch` erhalten. Falls du ihn nutzt, setze in GitHub `APP_URL` und `CRON_SECRET`.

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
