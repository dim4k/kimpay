/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const CACHE = `cache-${version}`;

const ASSETS = [
    ...build, // the app itself
    ...files, // everything in `static`
];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event) => {
    // Create a new cache and add all files to it
    async function addFilesToCache() {
        const cache = await caches.open(CACHE);
        await cache.addAll(ASSETS);

        // Try to cache the root route (App Shell)
        try {
            // Use { cache: 'reload' } to ensure we get a fresh version from the server
            const response = await fetch("/", { cache: "reload" });
            if (response.ok) {
                await cache.put("/", response);
            }
        } catch (e) {
            console.error("Failed to cache App Shell:", e);
        }
    }

    event.waitUntil(addFilesToCache());
    // Force the waiting service worker to become the active service worker
    sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
    // Remove previous cached data from disk
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE) await caches.delete(key);
        }
    }

    event.waitUntil(deleteOldCaches());
    // Take control of all clients immediately
    event.waitUntil(sw.clients.claim());
});

sw.addEventListener("fetch", (event) => {
    // ignore POST requests etc
    if (event.request.method !== "GET") return;

    // ignore extensions or other schemes
    if (!event.request.url.startsWith("http")) return;

    async function respond() {
        const url = new URL(event.request.url);

        // Ignore API requests (PocketBase)
        if (url.pathname.startsWith("/api/")) {
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
            // Add a timeout to the network request to avoid hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

            const response = await fetch(event.request, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 200) {
                cache.put(event.request, response.clone());
            }

            return response;
        } catch {
            // Network failed or timed out
            const cached = await cache.match(event.request);
            if (cached) return cached;

            // If it's a navigation request, try to serve the App Shell
            if (
                event.request.mode === "navigate" ||
                event.request.headers.get("accept")?.includes("text/html")
            ) {
                // 1. Try to serve the App Shell (/)
                const root = await cache.match("/");
                if (root) return root;

                // 2. Fallback to offline.html if App Shell is missing
                const offline = await cache.match("/offline.html");
                if (offline) return offline;

                // 3. Last resort
                return new Response("Offline", {
                    status: 408,
                    statusText: "Offline",
                });
            }

            // For non-navigation requests (images, fonts, etc), just fail
            // Returning "Offline" text for an image/script can cause parsing errors
            return new Response(null, { status: 404, statusText: "Not Found" });
        }
    }

    event.respondWith(respond());
});
