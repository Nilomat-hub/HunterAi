# HunterAi — Shipping Roadmap

**Ziel:** private Single-User-App, **online erreichbar** (nur der Besitzer, von extern nutzbar — auch per iPhone-PWA).

Diese Roadmap ist auf den **tatsächlichen** Stand von HunterAi abgestimmt. Vieles, was eine typische „Shipping-Checkliste" fordert, ist hier **schon erledigt** (siehe unten) — die Roadmap konzentriert sich nur auf die echten Lücken.

> Kontext: HunterAi ist die kanonische Codebase. Das ältere Hackathon-Monorepo `HHunter` (Fastify + Vanilla-JS) wird archiviert. Einziger übernehmenswerter Baustein dort: `kleinanzeigen.de`-Parser (siehe Phase B).

## Schon vorhanden (kein Handlungsbedarf)

- ✅ Auth (NextAuth, Login, Middleware-Schutz)
- ✅ DB mit Prisma (8 Modelle, Migrations)
- ✅ Vercel-Deployment-Story + `.env.example` + Setup-Guide
- ✅ Verschlüsselte Portal-Zugangsdaten (AES-256-GCM)
- ✅ Telegram-Benachrichtigungen + Webhook + Audit-Log
- ✅ Scoring, Deduplikation, Kontaktperson-Extraktion, Heuristiken
- ✅ OpenAI-Anschreiben mit deterministischem Fallback
- ✅ Bewerbungs-State-Machine + Rate-Limiting + Freigabe-zuerst (ADR 003)
- ✅ Apply-Automatik: immobilie1 direktes Absenden, Immomio Dry-Run-Vorbereitung

---

## Phase A — Der eine echte Blocker: Browser-Automation in Produktion 🔴

Quelle: HunterAis eigenes `GITHUB_VERCEL_SETUP.md` (Abschnitt „Playwright in Produktion").

Das Problem: Scraping **und** Apply-Automatik starten Chromium via Playwright. Auf **Vercel Serverless ist das unbestätigt** (Sandbox, Speicher, Laufzeit, Bot-Schutz). Wenn das nicht läuft, läuft der Kern der App nicht.

- [ ] **Hosting-Entscheidung treffen.** Für „privat + online" ist die einfachste Lösung wahrscheinlich **nicht** Vercel, sondern ein **kleiner VPS** (Hetzner/Render/Railway), der Next.js + Playwright + Postgres + Reverse-Proxy zusammen betreibt. Damit entfällt das Serverless-Chromium-Problem komplett. Alternativen: Browser-Automation in separaten Worker auslagern, oder Managed-Browser (Browserless).
- [ ] **Playwright-Lauf in der Zielumgebung live testen** (1× Extraktion + 1× immobilie1-Form-Submit), bevor irgendetwas als „läuft" gilt.
- [ ] Sicherstellen, dass Scrape-/Browser-Fehler den Scheduler **nicht** abbrechen (nur protokollieren) — teils schon umgesetzt, gegen die Zielumgebung verifizieren.

## Phase B — kleinanzeigen.de-Adapter (aus HHunter portiert) 🟠

- [ ] `KLEINANZEIGEN` zum `Portal`-Enum (Prisma) + Migration
- [ ] Domain-Mapping + Adapter in `lib/portals/adapters.ts` (`kleinanzeigen.de`)
- [ ] Portal in der UI-Liste (`portal-accounts`) und in Seed/Labels ergänzen
- [ ] kleinanzeigen-spezifische Extraktion (Label-basiert: Ort/Kaltmiete/Wohnfläche/Zimmer/Etage/Ausstattung) — generischer Extractor als Fallback, da kleinanzeigen.de starken Bot-Schutz hat (live testen)

## Phase C — Go-Live-Härtung 🟠

- [ ] **Default-Credentials entfernen:** `INITIAL_USER_PASSWORD=change-me` darf in Produktion nicht bestehen bleiben — beim Seed erzwingen, dass ein echtes Passwort gesetzt ist
- [ ] **CI-Gate:** GitHub-Actions-Workflow, der bei PR/Push `lint` + `build` + `tsx --test tests/*.test.ts` ausführt (aktuell existiert nur der manuelle Scheduler-Dispatch)
- [ ] **Scheduler-Kadenz konsolidieren:** `PROJECT_MEMORY` sagt „alle 10 Min", `vercel.json` sagt täglich 06:00, der Workflow ist nur manuell — auf eine Wahrheit bringen, passend zur Hosting-Entscheidung aus Phase A
- [ ] **HTTPS** sicherstellen (bei VPS via Reverse-Proxy/Let's Encrypt; bei Vercel automatisch)

## Phase D — Kernwert ausbauen: automatische Inserat-Entdeckung 🟡

Aktuell liefert `adapter.searchListings()` für alle Portale `[]` — d.h. Inserate kommen nur über **manuell eingefügte URLs** rein. Für einen Wohnungs-Jäger ist die automatische Suche der eigentliche Mehrwert.

- [ ] `searchListings()` pro Portal implementieren (mindestens 1 Portal als vertikaler Slice), inkl. Such-/Session-Handling — die Pipeline ist laut ADR 002 bereits dafür vorbereitet

## Phase E — Politur 🟢

- [ ] **PWA fürs iPhone:** `manifest.json`, `apple-touch-icon`, Meta-Tags → installierbar als Home-Screen-App (HunterAi hat aktuell kein Manifest)
- [ ] **Testabdeckung erhöhen:** Scoring, Pipeline-Dedup, Extraktion (aktuell nur 2 Testdateien: application-safety, portal-heuristics)
- [ ] **Immomio echtes Absenden** — falls gewünscht; aktuell bewusst Dry-Run gemäß ADR 003 (Freigabe-zuerst). Niedrige Priorität, ist eine Produktentscheidung, kein Bug.

---

**Kürzester Weg zu „läuft online für mich":** Phase A (Hosting/Playwright-Entscheidung) ist der Dreh- und Angelpunkt — ohne sie ist alles andere theoretisch. Danach C (Go-Live-Härtung), dann B/D nach Bedarf.
