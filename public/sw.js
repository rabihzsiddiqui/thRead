/*
 * thRead offline shell.
 *
 * Fragments never leave the device, so the only thing the network is needed
 * for is the app itself. Cache it and the app opens on a plane, in a lift, or
 * with no signal at all.
 *
 * Bump VERSION to evict every old cache on the next activate.
 */

const VERSION = "thread-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // the page itself: fresh when possible, cached when not
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // hashed bundles and fonts never change under a given URL
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const shell = await caches.match("/");
    if (shell) return shell;

    return new Response("offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }
  return response;
}
