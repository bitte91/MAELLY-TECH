// /public/service-worker.js
const CACHE = "mludico-v1";
const ASSETS = [ "/", "/manifest.webmanifest", "/assets/css/style.css", "/assets/js/app.js" ];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }))
  );
});
