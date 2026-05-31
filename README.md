# Apartment Hunter AI

Private Single-User-Webanwendung für Wohnungssuche, Inseratüberwachung, KI-Anschreiben und Telegram-Freigabe.

## Architektur

- Next.js 15 App Router mit TypeScript
- Prisma mit Vercel Postgres
- NextAuth Credentials Login für genau einen Benutzer
- Playwright für Inserat-Extraktion und spätere Portal-Automation
- OpenAI für deutsche Anschreiben
- Telegram Bot API für Benachrichtigungen und Freigabe
- Externer Scheduler über `POST /api/scheduler/run`

Die Scheduler-Route ist absichtlich unabhängig vom Anbieter. Für den Start ist GitHub Actions alle 10 Minuten vorbereitet. Später kann derselbe Endpoint von Upstash QStash, cron-job.org oder einem Worker aufgerufen werden.

## Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. `.env.example` nach `.env` kopieren und Werte eintragen.

Alternativ kann eine lokale `.env` mit sicheren Zufallswerten erzeugt werden:

```bash
npm run setup:env
```

3. Sichere Secrets erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Den Wert für `ENCRYPTION_KEY` verwenden. Für `NEXTAUTH_SECRET` und `SCHEDULER_SECRET` ebenfalls starke Zufallswerte nutzen.

4. Datenbank einrichten.

Lokale Entwicklung mit Docker:

```bash
npm run db:local:configure
npm run db:local:up
npm run prisma:migrate
npm run db:seed
npm run db:seed:demo
npm run setup:check
```

Wenn Docker nicht installiert ist, installiere Docker Desktop oder nutze direkt Vercel Postgres und trage die echte `DATABASE_URL` in `.env` ein.

Vercel Postgres:

1. In Vercel ein Postgres-Projekt anlegen.
2. `DATABASE_URL` aus Vercel kopieren.
3. Lokal und in Vercel als Environment Variable setzen.
4. Migration und Seed ausführen:

```bash
npm run prisma:migrate
npm run db:seed
npm run setup:check
```

5. Lokal starten:

```bash
npm run dev
```

## Telegram

Ja, BotFather ist der richtige Ansprechpartner.

1. In Telegram `@BotFather` öffnen.
2. `/newbot` senden.
3. Namen und Username vergeben.
4. Token als `TELEGRAM_BOT_TOKEN` speichern.
5. Dem Bot eine Nachricht senden.
6. Chat-ID ermitteln und als `TELEGRAM_CHAT_ID` speichern.

Für Inline-Buttons später den Webhook auf `/api/telegram/webhook` setzen.

## GitHub Actions Scheduler

In GitHub Repository Secrets setzen:

- `APP_URL`, zum Beispiel `https://deine-app.vercel.app`
- `SCHEDULER_SECRET`, identisch mit der Vercel Environment Variable

Der Workflow `.github/workflows/scheduler.yml` ruft alle 10 Minuten `POST /api/scheduler/run` auf.

Weitere Push- und Vercel-Hinweise stehen in `GITHUB_VERCEL_SETUP.md`.

## Vercel

In Vercel Environment Variables setzen:

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

Build Command:

```bash
npm run build
```

Nach Deployment:

```bash
npm run prisma:deploy
npm run db:seed
```

## Lokale Befehle ohne globales npm

Wenn Node/npm nicht global installiert ist, nutze die lokalen Wrapper:

```powershell
.\npm-local.cmd run build
.\npm-local.cmd run dev
.\npm-local.cmd run db:local:configure
```

## PyCharm

Das Projekt kann direkt in PyCharm geöffnet werden.

Empfohlene Run Configurations:

- Name: `dev`
- Script: `npm-local.cmd`
- Arguments: `run dev`
- Working directory: Projektordner

Weitere nützliche Configurations:

- `npm-local.cmd run lint`
- `npm-local.cmd run build`
- `npm-local.cmd run db:local:up`
- `npm-local.cmd run prisma:migrate`
- `npm-local.cmd run db:seed`
- `npm-local.cmd run db:seed:demo`
- `npm-local.cmd run setup:check`

Nach Docker-Installation ist der schnellste lokale Test:

```powershell
.\npm-local.cmd run db:local:up
.\npm-local.cmd run prisma:migrate
.\npm-local.cmd run db:seed
.\npm-local.cmd run db:seed:demo
.\npm-local.cmd run setup:check
.\npm-local.cmd run dev
```

## Aktueller Stand

Enthalten:

- Single-User Login
- Dashboard
- Suchprofile
- Portal-Konten mit verschlüsselter Speicherung
- Manuelle Inserat-URL
- Playwright-basierte Inserat-Extraktion
- Deduplikation
- Scoring
- KI-Anschreiben auf Deutsch
- Telegram-Benachrichtigung mit Buttons
- Bewerbungsfreigabe im Dashboard: bearbeiten, freigeben, ignorieren, als versendet markieren
- Externe Bewerbungslinks: Immomio-Links erkennen, speichern und Vorbereitung bis zum Login/Review-Status starten
- Scheduler-Endpoint mit Bearer Token
- GitHub-Actions-Scheduler

Die Portal-Suche ist als Adapter-Schicht vorbereitet. Die stabile Suchautomation sollte portalweise erweitert werden, weil jedes Portal andere Login-, Cookie-, Captcha- und DOM-Eigenheiten hat.
