const CACHE = 'medical-reserve-shell-1.1.2';
const OWNED_PREFIX = 'medical-reserve-shell-';
const SHELL = ['./', './index.html', './styles.css', './app.js?v=1.1.2', './version.js', './manifest.webmanifest', './icon.svg'];
const updateSensitive = request => request.mode === 'navigate' || ['script', 'style'].includes(request.destination);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(OWNED_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (updateSensitive(request)) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request.mode === 'navigate' ? './index.html' : request, response.clone())));
      return response;
    }).catch(() => caches.match(request.mode === 'navigate' ? './index.html' : request)));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, response.clone())));
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html'))));
});
