/* PLAIGROUND PWA. Network-first. Do not cache API or uploads. */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (!req || req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/api/') === 0) return;
  event.respondWith(fetch(req).catch(function () {
    return caches.match(req);
  }));
});
