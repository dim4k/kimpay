/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;

const ASSETS = [
  ...build, // the app itself
  ...files  // everything in `static`
];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event) => {
  // Create a new cache and add all files to it
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  }

  event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
  }

  event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
  // ignore POST requests etc
  if (event.request.method !== 'GET') return;

  // ignore extensions or other schemes
  if (!event.request.url.startsWith('http')) return;

  async function respond() {
    const url = new URL(event.request.url);

    // Ignore API requests (PocketBase)
    if (url.pathname.startsWith('/api/')) {
        return fetch(event.request);
    } 

    const cache = await caches.open(CACHE);

    // `build`/`files` can always be served from the cache
    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname);
      if (response) return response;
    }

    // for everything else, try the network first, but
    // fall back to the cache if we're offline
    try {
      const response = await fetch(event.request);

      if (response.status === 200) {
        cache.put(event.request, response.clone());
      }

      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      
      // If offline and navigating, try to serve a fallback HTML (App Shell pattern)
      if (event.request.mode === 'navigate') {
          // Ideally we return the home page or an offline page.
          // Since we might not know the exact home URL (dynamic /k/...), we can try to find *any* cached HTML
          // or specifically try to match the root '/' if we cached it.
          // But typically for this app, we cache visited pages.
          // Let's try to find a cached response that corresponds to the app shell.
          // A simple strategy is to try to match the referer or just return the cached '/' if available.
          // Better: Check if we have a match for the root or similar.
          
          // Use a dedicated OFFLINE_PAGE if we had one, but we don't.
          // Let's try to return the response for the referer (previous page) if it exists in cache?
          // No, that might be confusing. 
          
          // Let's try to match a known entry point.
          // We know the user is inside /k/[id]/...
          // We don't have a static shell. 
          
          // Best effort: Look for any cached HTML file? Expensive.
          // Let's rely on the fact that if we are here, we probably have some pages cached.
          // We will try to return the cached response for the referer if available, 
          // essentially reloading the "shell" of the previous page but letting client-side router handle the new URL.
          const refererv = event.request.headers.get('referer');
          if (refererv) {
              const refUrl = new URL(refererv);
              const refCached = await cache.match(refUrl.pathname);
              if (refCached) return refCached;
          }
      }

      return new Response('Offline', { status: 408, statusText: 'Offline' });
    }
  }

  event.respondWith(respond());
});
