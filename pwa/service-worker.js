// Minimal service worker — exists so the PWA is "installable".
// No caching yet; every request passes through to the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* pass through */ });
