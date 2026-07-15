// Huella service worker.
//
// Two jobs:
//   1. Push notifications + click-through (unchanged).
//   2. Offline media cache — audio clips and card images are stored on
//      the device so a pack, once downloaded, plays instantly and works
//      with no signal. We only ever cache Supabase Storage media
//      (/storage/v1/object/public/…); everything else — pages, API
//      calls, spaced-repetition state — passes straight through to the
//      network so study progress is never stale.

const MEDIA_CACHE = "huella-media-v1";

// Only Supabase public-storage objects (audio + images) are cacheable.
// Matching on the storage path keeps us project-ref-agnostic and means
// we never accidentally cache an API response or an HTML page.
function isCacheableMedia(url) {
  try {
    return new URL(url).pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

self.addEventListener("install", () => {
  // Take over as soon as installed — no waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop old cache versions on upgrade.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("huella-media-") && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Build a 206 Partial Content response from a full cached response.
// The <audio> element streams via Range requests; without this it can
// refuse to play a cached clip on Safari/iOS.
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

async function serveMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const rangeHeader = request.headers.get("range");

  // Match by URL string so a Range header on the request never changes
  // the lookup — we always store the full clip under its plain URL.
  let cached = await cache.match(request.url);

  if (!cached) {
    // Not on device yet. Fetch the WHOLE file in cors mode (Supabase
    // public buckets send CORS headers) so the cached body is readable
    // — needed to build Range responses later — then cache it. This
    // also means any clip the user simply encounters gets cached for
    // next time, not just explicitly-downloaded ones.
    try {
      const netResp = await fetch(request.url, { mode: "cors" });
      if (netResp && netResp.ok) {
        await cache.put(request.url, netResp.clone());
        cached = netResp;
      } else {
        // Non-OK (or cors blocked) — let the browser do its normal thing.
        return fetch(request);
      }
    } catch {
      // Offline and not cached — nothing we can do but try the network.
      return fetch(request).catch(
        () => new Response("", { status: 504, statusText: "Offline" }),
      );
    }
  }

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
  if (req.method !== "GET" || !isCacheableMedia(req.url)) return; // pass through
  event.respondWith(serveMedia(req));
});

// Explicit pack download. The client sends a list of media URLs (audio
// + images) and we fetch + store each, reporting progress back so the
// UI can show a bar. Bounded concurrency keeps a big pack from opening
// hundreds of sockets at once.
async function precache(urls, client) {
  const cache = await caches.open(MEDIA_CACHE);
  const total = urls.length;
  let done = 0;
  let idx = 0;
  const CONCURRENCY = 6;

  async function worker() {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const resp = await fetch(url, { mode: "cors" });
          if (resp && resp.ok) await cache.put(url, resp.clone());
        }
      } catch {
        // Skip a failed clip — the pack still mostly works offline.
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
      // Focus an existing tab if one's already open on our origin
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
