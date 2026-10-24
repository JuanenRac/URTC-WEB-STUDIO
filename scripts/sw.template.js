// Service worker of the Studio: it keeps a copy of the page and of the bundled firmware so the Studio opens and works
// without a network (a workshop with no internet). The build (vite.config.ts, plugin urtc-service-worker) fills in the
// two markers below and writes the result next to index.html as sw.js; this file is the template and is not served.
//
// Rules, in short:
//   - only GET requests to the origin of the page are handled; the GitHub API and the release hosts go straight to the network;
//   - version.json is never answered from a copy (the page asks for it to learn that a newer Studio is being served);
//   - the page itself (index.html) and the firmware manifest are network first, with the stored copy as the fallback offline,
//     so a person who is online always gets the newest page and manifest;
//   - everything else (hashed scripts and styles, fonts, images, firmware images and signatures) is copy first: the names of
//     those files change with their content;
//   - a new worker waits for the open tabs to close before it takes over (it does not take over at once): replacing the code of a page in the
//     middle of a flash or a bench session would be harmful.
'use strict';

const CACHE_PREFIX = 'urtc-web-studio-';
const CACHE_NAME = CACHE_PREFIX + '__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;
const NETWORK_FIRST_TIMEOUT_MS = 4000;
const NEVER_STORED = ['version.json', 'sw.js'];
const NETWORK_FIRST = ['firmware/firmware_manifest.json', 'firmware/firmware_manifest.json.sig'];

function scopePath(url) {
  const scope = new URL(self.registration.scope);
  const target = new URL(url);
  if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return null;
  return target.pathname.slice(scope.pathname.length);
}

/** How a request is answered: 'network' (not handled here), 'network-first' or 'cache-first'. */
function strategyFor(request) {
  if (request.method !== 'GET') return 'network';
  const path = scopePath(request.url);
  if (path === null) return 'network';
  if (NEVER_STORED.includes(path)) return 'network';
  if (request.mode === 'navigate' || path === '' || path === 'index.html') return 'network-first';
  if (NETWORK_FIRST.includes(path)) return 'network-first';
  return 'cache-first';
}

function storable(response) {
  return Boolean(response) && response.ok && response.status === 200 && response.type === 'basic';
}

async function remember(request, response) {
  if (!storable(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function networkFirst(request) {
  const key = request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : request;
  try {
    const response = await withTimeout(fetch(request), NETWORK_FIRST_TIMEOUT_MS);
    await remember(key, response);
    return response;
  } catch (error) {
    const stored = await caches.match(key, { ignoreSearch: true, ignoreVary: true });
    if (stored) return stored;
    throw error;
  }
}

async function cacheFirst(request) {
  // ignoreVary: the copy was stored by the install, without the headers a script or style request carries (Origin among them), and a host
  // that answers with Vary would otherwise make every stored script a miss
  const stored = await caches.match(request, { ignoreVary: true });
  if (stored) return stored;
  const response = await fetch(request);
  await remember(request, response);
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const base = self.registration.scope;
    // 'reload' skips the HTTP cache so the copy is what the host serves now, not an older answer
    await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, base).href, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request);
  if (strategy === 'network') return;
  event.respondWith(strategy === 'network-first' ? networkFirst(event.request) : cacheFirst(event.request));
});
