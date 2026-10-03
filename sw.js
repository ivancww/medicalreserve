const SHELL_CACHE = 'medical-reserve-shell';
const SHELL_CACHE_PREFIX = 'medical-reserve-shell';
const SHELL = ['./', './index.html', './styles.css', './app.js', './domain.js', './admin.js', './manifest.webmanifest', './icon.svg', './sw.js'];

function isOwnedShellRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return true;
  return SHELL.some(path => new URL(path, self.location.href).pathname === url.pathname);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE)
    .map(key => caches.delete(key))
  )).then(() => self.clients.claim())));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !isOwnedShellRequest(event.request)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
