const CACHE_NAME = 'bus-pwa-v2';
// Incluindo todos os arquivos da aplicação
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/data.json'
];

// Instalação: Coloca todos os arquivos essenciais no cache.
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando e armazenando em cache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  // Garante que o novo SW assuma o controle mais rápido, pulando a etapa 'waiting'.
  self.skipWaiting(); 
});

// Ativação: Limpa caches antigos, garantindo que apenas a versão atualizada permaneça.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando e limpando caches antigos...');
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
    }).then(() => self.clients.claim()) // Permite que o SW controle os clientes imediatamente
  );
});

// Busca/Fetch: Estratégia Cache-First (primeiro tenta o cache, depois a rede).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o recurso do cache se ele existir
        if (response) {
          return response;
        }
        
        // Se não estiver no cache, busca na rede
        return fetch(event.request);
      })
  );
});