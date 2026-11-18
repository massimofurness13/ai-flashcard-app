// Huella service worker.
//
// Three jobs:
//   1. Push notifications + click-through.
//   2. Offline media cache — audio/images from a DOWNLOADED pack are
//      served from the device.
//   3. Anonymous, audited application shells and their immutable assets.
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
const ASSET_CACHE = "huella-static-v1";
const SHELL_INDEX = "huella-shell-index-v1";
const SHELL_PREFIX = "huella-shell-v1-";
const SHELL_POINTER = new URL("/__huella_shell__", self.location.origin).href;
// These pages and their shared layout render NO account data on the server.
// Re-audit before adding a route or moving personal data into server props.
const SHELL_ROUTES = ["/", "/study", "/study/session", "/account", "/account/downloads", "/stats"];
let preparingShell = null;

function isFlight(request, url) {
  return url.searchParams.has("_rsc") || request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    (request.headers.get("accept") || "").includes("text/x-component");
}

function isStaticAsset(url) {
  return url.origin === self.location.origin && !url.search &&
    /^\/_next\/static\/[\w./-]+\.(?:js|css|woff2?|ttf|otf|png|svg|webp|jpe?g|gif|ico)$/.test(url.pathname);
}

function publicResponse(response, contentType) {
  return response.status === 200 && !response.redirected &&
    response.type !== "opaque" &&
    !response.headers.has("set-cookie") &&
    !/(?:private|no-store)/i.test(response.headers.get("cache-control") || "") &&
    !/(?:\*|cookie|authorization)/i.test(response.headers.get("vary") || "") &&
    contentType.test(response.headers.get("content-type") || "");
}

// Only immutable, same-origin Next build assets. No image optimizer, APIs,
// source maps, external scripts, or arbitrary URLs supplied by a client.
function assetReferences(text, base, css = false) {
  const urls = new Set();
  for (const match of text.matchAll(/(?:\/_next\/static\/|static\/chunks\/)[\w./-]+\.(?:js|css|woff2?|ttf|otf|png|svg|webp|jpe?g|gif|ico)/g)) {
    const path = match[0].startsWith("/") ? match[0] : `/_next/${match[0]}`;
    const url = new URL(path, self.location.origin);
    if (isStaticAsset(url)) urls.add(url.href);
  }
  if (css) {
    for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
      const url = new URL(match[1], base);
      if (isStaticAsset(url)) urls.add(url.href);
    }
  }
  return urls;
}

async function saveAsset(url, cache) {
  const cached = await cache.match(url);
  if (cached) return cached;
  const response = await fetch(url, { credentials: "omit", redirect: "error", cache: "no-cache", signal: AbortSignal.timeout(15000) });
  const pathname = new URL(url).pathname;
  const type = pathname.endsWith(".js") ? /(?:javascript|ecmascript)/i :
    pathname.endsWith(".css") ? /^text\/css/i : /^(?:font\/|image\/|application\/(?:font|octet-stream|vnd\.ms-fontobject))/i;
  if (!publicResponse(response, type)) throw new Error("Unsafe or unavailable application asset");
  await cache.put(url, response.clone());
  return response;
}

async function prepareAppShell() {
  const documents = [];
  const assets = new Set();
  let build;
  for (const path of SHELL_ROUTES) {
    // Never save the actual navigation response: it may carry identity,
    // query-specific data, or auth cookies. Fetch a clean public document.
    const response = await fetch(new URL(path, self.location.origin).href, {
      credentials: "omit", redirect: "error", cache: "no-store",
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!publicResponse(response, /^text\/html/i)) throw new Error("Public shell unavailable");
    const html = await response.clone().text();
    // Next's initial Flight payload embeds the navigation build id. Fail
    // closed if its format changes; never publish shells from mixed builds.
    const id = html.replace(/\\"/g, '"').match(/"b"\s*:\s*"([\w-]+)"/)?.[1];
    if (!id || (build && id !== build)) throw new Error("Application build changed during preparation");
    build = id;
    const refs = assetReferences(html, self.location.origin);
    if (!refs.size) throw new Error("Application shell has no build assets");
    for (const url of refs) assets.add(url);
    documents.push({ path, response });
  }
  const cache = await caches.open(ASSET_CACHE);
  // Set iteration visits newly discovered dependencies too. Fetching bounded
  // batches avoids competing with the study audio connection pool.
  const pending = [...assets];
  for (let i = 0; i < pending.length;) {
    const batch = pending.slice(i, i + 4);
    i += batch.length;
    await Promise.all(batch.map(async (url) => {
      const response = await saveAsset(url, cache);
      if (/\.(?:js|css)$/.test(new URL(url).pathname)) {
        for (const dependency of assetReferences(await response.text(), url, url.endsWith(".css"))) {
          if (!assets.has(dependency)) { assets.add(dependency); pending.push(dependency); }
        }
      }
    }));
  }
  const cacheName = `${SHELL_PREFIX}${build}`;
  const shells = await caches.open(cacheName);
  for (const { path, response } of documents) {
    await shells.put(new URL(path, self.location.origin).href, response);
  }
  // One atomic pointer update, only AFTER every document and asset succeeded.
  // A failed update keeps the previous working build available.
  const index = await caches.open(SHELL_INDEX);
  const oldPointer = await index.match(SHELL_POINTER);
  const previous = oldPointer ? (await oldPointer.json()).cacheName : null;
  await index.put(SHELL_POINTER, new Response(JSON.stringify({ cacheName, build, assets: [...assets] }), {
    headers: { "Content-Type": "application/json" },
  }));
  // Keep the previous shell as well. Hashed assets intentionally outlive both:
  // an already-open tab may still request a lazy chunk from an older build.
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(SHELL_PREFIX) && key !== cacheName && key !== previous)
    .map(key => caches.delete(key)));
  return { ready: true, build, routes: SHELL_ROUTES };
}

async function checkAppShell() {
  const pointer = await (await caches.open(SHELL_INDEX)).match(SHELL_POINTER);
  if (!pointer) return { ready: false };
  const { cacheName, build, assets } = await pointer.json();
  const shells = await caches.open(cacheName);
  const files = await caches.open(ASSET_CACHE);
  for (const path of SHELL_ROUTES) {
    if (!(await shells.match(new URL(path, self.location.origin).href, { ignoreVary: true }))) return { ready: false };
  }
  if (!Array.isArray(assets) || !assets.length) return { ready: false };
  for (const asset of assets) {
    if (!(await files.match(asset))) return { ready: false };
  }
  return { ready: true, build, routes: SHELL_ROUTES };
}

async function cachedShell(path) {
  const index = await caches.open(SHELL_INDEX);
  const pointer = await index.match(SHELL_POINTER);
  if (!pointer) return undefined;
  const { cacheName } = await pointer.json();
  const cache = await caches.open(cacheName);
  // This lookup is ONLY reached for document navigation, never RSC. Ignore
  // Next's Vary headers because the stored response is explicitly HTML.
  return cache.match(new URL(path, self.location.origin).href, { ignoreVary: true });
}

async function navigateShell(request, path) {
  try {
    const response = await fetch(request);
    if (response.status < 500) return response;
    return (await cachedShell(path)) || response;
  } catch {
    const cached = await cachedShell(path);
    return cached || Response.error();
  }
}

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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // RSC/Flight and prefetch responses must NEVER share an HTML cache key.
  // Next itself falls back to document navigation if an RSC fetch fails.
  if (isFlight(req, url)) return;
  if (url.origin === self.location.origin && req.mode === "navigate" && SHELL_ROUTES.includes(url.pathname)) {
    event.respondWith(navigateShell(req, url.pathname));
    return;
  }
  if (isStaticAsset(url) && !req.headers.has("range")) {
    event.respondWith((async () => {
      try { return await saveAsset(url.href, await caches.open(ASSET_CACHE)); }
      catch { return fetch(req); }
    })());
    return;
  }
  if (!isCacheableMedia(req.url)) return;
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
    event.waitUntil(precache(data.urls.filter(url => typeof url === "string" && isCacheableMedia(url)), event.source));
  }
  if (data.type === "PREPARE_APP_SHELL") {
    if (!preparingShell) preparingShell = prepareAppShell().finally(() => { preparingShell = null; });
    const reply = event.ports?.[0] || event.source;
    event.waitUntil(preparingShell.then(
      result => reply?.postMessage({ type: "APP_SHELL_RESULT", ...result }),
      () => reply?.postMessage({ type: "APP_SHELL_RESULT", ready: false }),
    ));
  }
  if (data.type === "CHECK_APP_SHELL") {
    const reply = event.ports?.[0] || event.source;
    event.waitUntil(checkAppShell().then(
      result => reply?.postMessage({ type: "APP_SHELL_RESULT", ...result }),
      () => reply?.postMessage({ type: "APP_SHELL_RESULT", ready: false }),
    ));
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
