# Projekt-Memory

Stand: 2026-06-01

## Ziel

Private Single-User-App fuer die Wohnungssuche:

- Inserate aus URLs extrahieren
- Duplikate erkennen
- Scoring berechnen
- saubere deutsche Anschreiben generieren
- Bewerbungen erst nach Freigabe vorbereiten/versenden
- Telegram-Benachrichtigungen und spaeter Auto-Modus

## Lokale Umgebung

- Projektpfad unter WSL:
  `/mnt/c/Users/nilsv/OneDrive/Dokumente/Wohnungsuche Ai`
- Projektpfad unter Windows:
  `C:\Users\nilsv\OneDrive\Dokumente\Wohnungsuche Ai`
- Lokaler Start aus WSL:

```bash
cd "/mnt/c/Users/nilsv/OneDrive/Dokumente/Wohnungsuche Ai"
cmd.exe /c npm-local.cmd run dev
```

- Lokaler Wrapper nutzt portable Node/npm aus `.tools`.
- Docker/Postgres laeuft lokal ueber `docker-compose.yml`.
- `.env` enthaelt echte lokale Secrets und darf nicht gepusht werden.

## App-Status

Bereits umgesetzt:

- Next.js Dashboard mit Login
- Suchprofile
- Profil/Einstellungen inklusive Bewerbungsprofil
- Portal-Konten mit verschluesselter Speicherung
- manuelle Inserat-URL
- Playwright-basierte Extraktion
- Deduplikation
- Scoring
- OpenAI-Anschreiben mit professionellem Fallback
- Bewerbungsfreigabe im Dashboard
- externe Bewerbungslinks, besonders Immomio
- Status `PREPARING` und `READY_TO_SUBMIT`
- Telegram-Logs und Telegram-Uebersicht
- GitHub-Actions-Scheduler alle 10 Minuten
- Vercel/GitHub-Setup-Doku

## Wichtige Designentscheidungen

- Keine automatische finale Absendung ohne ausdrueckliche Freigabe.
- Inseratstitel werden im Anschreiben nicht woertlich zitiert.
- Profilwerte werden strukturiert genutzt.
- Budget wird als monatlich zuverlaessig verfuegbar formuliert, nicht als Gehalt.
- Buergschaft wird nur als optionaler Sicherheitsbaustein erwaehnt.
- Zusaetzliche Extraktionsdetails werden vorerst in `Listing.rawData.details` gespeichert, damit keine neue Migration noetig ist.

## Relevante Testdaten

Immobilie1-Testlink:

```text
https://www.immobilie1.de/expose/32660069?utm_source=newsletter&utm_medium=email&utm_campaign=suchagent-ergebnisse
```

Erkannt wurde:

- Portal: `IMMOBILIE1`
- Stadtteil: `Ohlsdorf`
- Adresse: `Fuhlsbuettler Strasse · 22337 · Hamburg · Deutschland`
- externer Bewerbungslink: Immomio
- Kontaktmethode: `EXTERNAL`

## Naechste sinnvolle Schritte

1. GitHub-Repository verbinden und initial pushen.
2. Vercel-Projekt verbinden.
3. Vercel Environment Variables setzen.
4. Vercel Postgres oder externe Postgres-DB anbinden.
5. Migrationen in Produktion ausfuehren.
6. Telegram-Bot mit BotFather einrichten und Webhook setzen.
7. Immomio-Login speichern und Vorbereitung im Browser erneut testen.
8. Danach Auto-Modus vorsichtig aktivieren: erst vorbereiten, spaeter nur mit klaren Sicherheitsregeln absenden.

## Keine Secrets

Diese Datei enthaelt absichtlich keine API-Keys, Passwoerter, Tokens oder echten privaten Zugangsdaten.
