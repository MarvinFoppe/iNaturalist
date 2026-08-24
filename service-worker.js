// Minimaler Service Worker – ermöglicht die Installation als App ("PWA").
// Kein Offline-Zwang: Anfragen laufen network-first (immer aktuelle Daten),
// der Cache dient nur als Rückfallebene, wenn gerade kein Netz da ist.
const CACHE = 'inat-shell-v9';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Nur gleiche Herkunft cachen; iNaturalist-API, CDNs und Fonts normal durchlassen
  if (new URL(req.url).origin !== self.location.origin) return;
  // API-Antworten nicht in den Shell-Cache legen (haben eigenes Caching)
  if (new URL(req.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ===== Push-Benachrichtigungen =====
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || '🌿 Naturbeobachtungen';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Neue Art freigeschaltet!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [40, 30, 40],
    data: { url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
