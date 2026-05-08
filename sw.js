// === Service Worker 版本管理 ===
// 每次你修改了 index.html, script.js 或 style.css 後，
// 必須更改下面的 CACHE_NAME 編號（例如下次改做 v2.0.7），否則手機 App 唔會更新。
const CACHE_NAME = 'medical-reserve-cache-v2.0.6';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. 安裝階段：強制跳過等待，即時更新
self.addEventListener('install', event => {
  console.log('[Service Worker] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 正在快取所有資源');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 強制令新版 SW 即刻上位
  );
});

// 2. 激活階段：清理舊版本的垃圾 Cache
self.addEventListener('activate', event => {
  console.log('[Service Worker] 正在激活並清理舊 Cache...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 如果發現 Cache 名稱同而家最新嘅唔同，就直接剷走佢
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 刪除過時 Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 確保新版 SW 即時控制所有分頁
  );
});

// 3. 抓取階段：網絡優先策略（適合會更新的 App）
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
