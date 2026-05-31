# Architekturentscheidungen

## ADR 001: Externer Scheduler statt Vercel Cron

Vercel Hobby-Crons sind für eine 10-Minuten-Überwachung nicht geeignet. Die Anwendung stellt deshalb `POST /api/scheduler/run` bereit. Der Aufrufer authentifiziert sich per Bearer Token aus `SCHEDULER_SECRET`.

Startlösung: GitHub Actions alle 10 Minuten.  
Spätere robuste Lösung: Upstash QStash oder ein dedizierter Worker.

## ADR 002: Portal-Adapter

Jedes Portal erhält einen eigenen Adapter. Die gemeinsame Pipeline bleibt gleich:

Inserat finden oder URL öffnen, Daten extrahieren, Deduplikation, Score, Anschreiben, Telegram-Freigabe.

So kann ImmoScout24 anders behandelt werden als Immowelt, ohne Scoring, Bewerbungen oder UI anzufassen.

## ADR 003: Freigabemodus zuerst

Automatisches Absenden ist riskant. Standard ist:

Inserat erkannt, Anschreiben erzeugt, Telegram senden, Benutzer entscheidet.

Der Auto-Modus ist im Datenmodell vorbereitet, aber bewusst nicht als Standard aktiviert.

## ADR 004: Secrets in Environment Variables

`.env` ist für lokale Entwicklung passend, echte Deployments nutzen Vercel Environment Variables und GitHub Repository Secrets.

Portal-Zugangsdaten, Cookies und Sessions werden zusätzlich mit AES-256-GCM verschlüsselt gespeichert.

## ADR 005: Lokale Postgres-Entwicklung

Die Produktion nutzt Vercel Postgres. Für lokale Entwicklung stellt das Projekt zusätzlich `docker-compose.yml` bereit. Dadurch bleibt Prisma im PostgreSQL-Modus und das Datenmodell muss nicht für SQLite oder andere lokale Ersatzdatenbanken vereinfacht werden.
