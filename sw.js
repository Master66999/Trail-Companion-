// Service worker: makes the app shell + Transformers.js runtime available offline.
// (Model weights are cached separately by Transformers.js in the "transformers-cache" bucket.)
const VERSION = 'tc-v2';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/db.js', 'js/species.js', 'js/scoring.js', 'js/worker.js',
  'data/text-embeddings.json',
  'samples/maple-leaf.jpg', 'samples/cardinal.jpg', 'samples/fly-agaric.jpg',
  'samples/monarch.jpg', 'samples/sunflower.jpg', 'samples/laptop-desk.jpg',
];
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tc-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Same-origin app shell: network-first (fresh when online), cache fallback (offline).
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(request, copy)); }
        return res;
      }).catch(() => caches.match(request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Versioned CDN assets (Transformers.js, ONNX Runtime WASM, fonts): cache-first.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(request, copy)); }
        return res;
      }))
    );
  }
});
