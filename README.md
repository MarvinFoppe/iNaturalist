# Naturbeobachtungen (iNaturalist-App)

Eine deutschsprachige Progressive Web App rund um iNaturalist-Beobachtungen:
Weltkarte, Galerie, Arten- und Erstbeobachtungen im Zeitraum, Seltenheits-Dashboard,
Saison-Challenges & Badges, Freundevergleich, Statistiken und „In meiner Nähe".

## Aufbau

- **`index.html`** – die komplette Frontend-App (Vanilla-JS, kein Build-Schritt). Leaflet für Karten.
- **`api/`** – Vercel Serverless Functions (Node, ESM):
  - `inat.js` – Proxy/Cache für die iNaturalist-API
  - `friends.js`, `seen.js`, `badgelevels.js`, `state.js` – geräteübergreifender Zustand (Upstash Redis)
  - `subscribe.js`, `vapid.js`, `test-push.js`, `cron/notify.js` – Web-Push-Benachrichtigungen
  - `health.js` – Health-Check · `_redis.js` – Redis-Client-Helfer
- **`service-worker.js`** – PWA-Shell (network-first) + Push-Handling
- **`manifest.json`**, Icons – PWA-Metadaten
- **`_dev/`** – lokale Preview-/Demo-Seiten (nicht deployt, via `.gitignore` ausgeschlossen)

## Entwicklung & Deployment

Kein Build nötig – statisches Frontend + Serverless-Functions, gehostet auf **Vercel**
(GitHub Pages als Fallback). Konfiguration in `vercel.json` (Cron, Header). Benötigte
Env-Variablen: `KV_REST_API_URL`/`KV_REST_API_TOKEN` (Redis), `VAPID_PUBLIC_KEY`/
`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (Push), `CRON_SECRET`.

> Nach Änderungen an `index.html`/`service-worker.js` die Cache-Version im
> Service Worker (`inat-shell-vN`) hochzählen, damit Nutzer den neuen Stand erhalten.
