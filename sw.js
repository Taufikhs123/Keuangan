// Service Worker for Keuangan PWA
// Strategy: network-first for the app shell (so you always get the latest
// version from GitHub when online), cache fallback when offline.

const CACHE = 'keuangan-v3-auto-sync-current-month-20261022';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './finance-core.js',
  './app-integrity.js',
  './trips.js',
  './app-boot.js',
  './app-design.css',
  './app-shell.css',
  './app-panels.css',
  './app-appearance.css',
  './app-live.css',
  './app-appearance.js',
  './app-savings-ui.js',
  './app-ui.js',
  './AppsScript.gs',
  './mood-happy.png',
  './mood-normal.png',
  './mood-worried.png',
  './mood-broke.png',
  './mood-neutral.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.search || !ASSETS.some(p => new URL(p,self.location.href).pathname === url.pathname)) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // Update cache with fresh copy
        if(res.ok){const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});}
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode==='navigate'?caches.match('./index.html'):Response.error())))
  );
});
