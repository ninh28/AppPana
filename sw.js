const CACHE_PREFIX = 'prdcv-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  './assets/tailwind.css',
  './assets/css/fontawesome.css',
  './assets/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(cached => cached || fetch(request)));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
