// Service Worker for Keuangan PWA
// Strategy: network-first for the app shell (so you always get the latest
// version from GitHub when online), cache fallback when offline.

const CACHE = 'keuangan-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Install: pre-cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fall back to cache when offline
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // never cache POSTs (Google Sheets sync)

  // Never intercept Google Apps Script calls — always go to network
  if (req.url.includes('script.google.com')) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // Update cache with fresh copy
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
