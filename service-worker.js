const CACHE_NAME = 'bus-pwa-v5'; // Versão atualizada
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// Instalação: Coloca todos os arquivos essenciais no cache.
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando e armazenando em cache (V5)...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); 
});

// Ativação: Limpa caches antigos, garantindo que apenas a versão atualizada permaneça.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando e limpando caches antigos (V5)...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Busca/Fetch: Estratégia Cache-First
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
