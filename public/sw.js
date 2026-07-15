// Huella service worker.
//
// Two jobs:
//   1. Push notifications + click-through.
//   2. Offline media cache — audio/images from a DOWNLOADED pack are
//      served from the device.
//
// CRITICAL LESSON (fixed here): the first version intercepted EVERY
// Supabase media request and did a full-file re-fetch on each one to
// cache it opportunistically. Combined with the study preloader that
// warms ~10 cards ahead, that flooded the browser's per-host connection
// pool and STALLED audio playback — the <audio> element sat at
// readyState 0 waiting for bytes that never arrived. So this version
// only ever intercepts media the user has EXPLICITLY downloaded (tracked
// in `cachedUrls`); every other request is left 100% to the browser's
// native loader. No download = behaves exactly as if the SW weren't
// there.

const MEDIA_CACHE = "huella-media-v2";

// In-memory set of URLs we have on the device. The fetch handler must
// decide synchronously whether to intercept (you can't "un-intercept"
// after respondWith), so we can't consult the async Cache there —
// hence this mirror. Repopulated on every SW startup + after a download.
let cachedUrls = new Set();

async function loadCachedUrls() {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    cachedUrls = new Set(keys.map((k) => k.url));
  } catch {
    /* ignore */
  }
}
// Kick off on every SW startup (install AND wake-from-idle), not just
// activate — a woken SW re-runs this module but not the activate event.
loadCachedUrls();

function isCacheableMedia(url) {
  try {
    return new URL(url).pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("huella-media-") && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k)),
      );
      await loadCachedUrls();
      await self.clients.claim();
    })(),
  );
});

// Build a 206 Partial Content response from a full cached response, for
// the <audio> element's Range requests. Only used for DOWNLOADED clips.
async function rangeResponse(fullResp, rangeHeader) {
  const buf = await fullResp.clone().arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start > end || start >= size) start = 0;
  const slice = buf.slice(start, end + 1);
  const headers = new Headers();
  headers.set(
    "Content-Type",
    fullResp.headers.get("Content-Type") || "audio/mpeg",
  );
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(slice.byteLength));
  headers.set("Accept-Ranges", "bytes");
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

async function serveDownloaded(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request.url);
  if (!cached) {
    // Raced with an eviction — fall back to the network.
    return fetch(request);
  }
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    try {
      return await rangeResponse(cached, rangeHeader);
    } catch {
      return cached;
    }
  }
  return cached;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !isCacheableMedia(req.url)) return; // native
  // ONLY intercept media we've explicitly downloaded. Everything else is
  // left to the browser (no interception, no stalls, no regression).
  if (!cachedUrls.has(req.url)) return;
  event.respondWith(serveDownloaded(req));
});

// Explicit pack download. Client sends a list of media URLs; we fetch +
// store each and report progress. Bounded concurrency so a big pack
// doesn't open hundreds of sockets. Each stored URL is added to
// `cachedUrls` so the fetch handler starts serving it.
async function precache(urls, client) {
  const cache = await caches.open(MEDIA_CACHE);
  const total = urls.length;
  let done = 0;
  let idx = 0;
  const CONCURRENCY = 4;

  async function worker() {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        if (!cachedUrls.has(url) && !(await cache.match(url))) {
          const resp = await fetch(url, { mode: "cors" });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
            cachedUrls.add(url);
          }
        } else {
          cachedUrls.add(url);
        }
      } catch {
        /* skip a failed clip */
      }
      done++;
      client?.postMessage({ type: "PRECACHE_PROGRESS", done, total });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total || 1) }, worker),
  );
  client?.postMessage({ type: "PRECACHE_DONE", total });
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "PRECACHE" && Array.isArray(data.urls)) {
    event.waitUntil(precache(data.urls, event.source));
  }
});

// ── Push notifications (unchanged) ──────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Huella", body: event.data.text() };
  }

  const title = payload.title || "Huella";
  const options = {
    body: payload.body || "Time for today's cards.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/study" },
    tag: payload.tag || "huella-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/study";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
