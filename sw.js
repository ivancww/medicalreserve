const CACHE_NAME = 'medical-reserve-cache-v3'; // 每次大更新，一定要改呢個數字 (例如 v4, v5)

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './IMG_4682.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // 強制立即接管
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 如果 cache 名唔同而家最新嘅名，就洗走舊嗰個
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: 清除舊 Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 確保更新後即刻控制所有打開緊嘅網頁
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
