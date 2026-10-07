/* Service worker de Mes comptes : réseau d'abord pour la page (toujours la dernière version),
   cache pour les fichiers avec ?v= ; hors connexion, la page en cache s'ouvre quand même (les chiffres sont dans le téléphone).
   On ne touche qu'à NOS caches (origine partagée avec les autres sites d'Ahmed). */
const CACHE_VERSION = "20261007a";
const CACHE = "mes-comptes-" + CACHE_VERSION;
const PORTEE = new URL("./", self.location).pathname;

self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "assets/style.css?v=20261007a", "assets/app.js?v=20261007a", "assets/protection.js?v=20261007a", "assets/icons/icon.svg"]).catch(() => {}))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith("mes-comptes-") && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(PORTEE)) return;
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })));
});
