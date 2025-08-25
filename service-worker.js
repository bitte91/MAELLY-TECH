// BNCC Avançado v2.3 — service-worker.js
const CACHE = 'bncc-adv-v2.3::precache';
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './bncc.json',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  // CDNs (tentamos pré-cache para offline total)
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Stale-while-revalidate para tudo
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    const fetchPromise = fetch(event.request).then(resp => {
      // Cache apenas GET e respostas ok
      if(event.request.method === 'GET' && resp && (resp.status===200 || resp.type === 'opaque')){
        cache.put(event.request, resp.clone());
      }
      return resp;
    }).catch(_=> cached);
    return cached || fetchPromise;
  })());
});
