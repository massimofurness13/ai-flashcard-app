import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const origin = "https://huella.test";
const routes = ["/", "/study", "/study/session", "/account", "/account/downloads", "/stats"];
const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
type Key = string | { url: string };
const key = (value: Key) => typeof value === "string" ? value : value.url;

function harness() {
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (url: Key) => store.get(key(url))?.clone(),
        put: async (url: Key, response: Response) => { store.set(key(url), response.clone()); },
        keys: async () => [...store.keys()].map(url => ({ url })),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  let build = "build-one";
  const html = () => `<html><script src="/_next/static/chunks/${build}.js"></script><link href="/_next/static/chunks/style.css" rel="stylesheet"><script>self.__next_f.push([1,"0:{\\"b\\":\\"${build}\\"}"])</script></html>`;
  const network = vi.fn(async (input: Key, _options?: RequestInit): Promise<Response> => {
    void _options;
    const url = new URL(key(input));
    if (routes.includes(url.pathname)) return new Response(html(), { headers: { "Content-Type": "text/html", "Cache-Control": "s-maxage=31536000" } });
    if (url.pathname.endsWith(".css")) return new Response('@font-face{src:url(../media/font.woff2)}', { headers: { "Content-Type": "text/css" } });
    if (url.pathname.endsWith(".js")) return new Response(url.pathname.endsWith("lazy.js") ? "/* lazy */" : 'load("static/chunks/lazy.js")', { headers: { "Content-Type": "application/javascript" } });
    return new Response("font", { headers: { "Content-Type": "font/woff2" } });
  });
  const handlers: Record<string, (event: unknown) => void> = {};
  const self = {
    location: { origin },
    navigator: { onLine: true },
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    skipWaiting: vi.fn(), clients: { claim: vi.fn() },
  };
  function boot() {
    runInNewContext(source, { self, caches, fetch: network, URL, Headers, Response, AbortSignal, AbortController, setTimeout, clearTimeout, Set, console });
  }
  boot();
  async function message(type = "PREPARE_APP_SHELL", urls?: string[]) {
    let task: Promise<unknown> | undefined;
    const reply = vi.fn();
    handlers.message({ data: { type, urls }, ports: [{ postMessage: reply }], source: { postMessage: reply }, waitUntil: (promise: Promise<unknown>) => { task = promise; } });
    await task;
    return reply.mock.calls.at(-1)?.[0];
  }
  function request(path: string, mode = "navigate", headers: Record<string, string> = {}, method = "GET") {
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: { url: new URL(path, origin).href, mode, method, headers: new Headers(headers) }, respondWith: (promise: Promise<Response>) => { response = promise; } });
    return response;
  }
  return { stores, caches, network, message, request, boot, setOnline: (online: boolean) => { self.navigator.onLine = online; }, setBuild: (value: string) => { build = value; } };
}

describe("anonymous offline application shell", () => {
  it("opens a saved shell without a network request when offline", async () => {
    const h = harness(); await h.message(); h.network.mockClear(); h.setOnline(false);
    expect(await (await h.request("/"))?.text()).toContain("build-one.js");
    expect(h.network).not.toHaveBeenCalled();
  });

  it("bounds a hanging network request instead of trapping an iOS launch", async () => {
    vi.useFakeTimers();
    try {
      const h = harness(); await h.message();
      h.network.mockImplementation(() => new Promise(() => {}));
      const response = h.request("/study");
      await vi.advanceTimersByTimeAsync(1201);
      expect(await (await response)?.text()).toContain("build-one.js");
    } finally { vi.useRealTimers(); }
  });

  it("renders an honest recovery page when no offline shell exists", async () => {
    const h = harness(); h.setOnline(false);
    const response = await h.request("/");
    expect(response?.status).toBe(503);
    expect(await response?.text()).toContain("offline view is not ready");
  });

  it("prepares every audited route anonymously plus transitive JS/CSS/font assets", async () => {
    const h = harness();
    expect(await h.message()).toMatchObject({ ready: true, build: "build-one", routes });
    for (const route of routes) expect(h.network).toHaveBeenCalledWith(origin + route, expect.objectContaining({ credentials: "omit", redirect: "error", cache: "no-store", headers: { Accept: "text/html" } }));
    const files = h.stores.get("huella-static-v1")!;
    expect(files.has(origin + "/_next/static/chunks/lazy.js")).toBe(true);
    expect(files.has(origin + "/_next/static/media/font.woff2")).toBe(true);
    expect(await h.message("CHECK_APP_SHELL")).toMatchObject({ ready: true });
  });

  it("cold worker startup serves route documents regardless of session query", async () => {
    const h = harness();
    await h.message();
    h.boot();
    h.network.mockRejectedValue(new TypeError("offline"));
    for (const route of routes) {
      const response = await h.request(route + "?filter=daily&limit=120");
      expect(response?.status).toBe(200);
      expect(await response?.text()).toContain("build-one.js");
    }
    expect((await h.request("/_next/static/chunks/lazy.js", "cors"))?.status).toBe(200);
  });

  it("never caches navigation responses containing a previous account's data", async () => {
    const h = harness();
    await h.message();
    h.network.mockResolvedValueOnce(new Response("private Alice HTML", { headers: { "Content-Type": "text/html" } }));
    expect(await (await h.request("/account"))?.text()).toBe("private Alice HTML");
    h.network.mockRejectedValue(new TypeError("offline"));
    expect(await (await h.request("/account"))?.text()).not.toContain("Alice");
  });

  it("leaves APIs, private pages, writes, optimized images and all RSC variants alone", async () => {
    const h = harness();
    await h.message();
    for (const path of ["/api/user/me", "/auth/login", "/decks/secret/edit", "/account/billing", "/_next/image?url=private", "/study?_rsc=abc"]) expect(h.request(path)).toBeUndefined();
    const flightHeaders: Record<string, string>[] = [{ RSC: "1" }, { "Next-Router-State-Tree": "[]" }, { "Next-Router-Prefetch": "1" }, { "Next-Router-Segment-Prefetch": "/_tree" }, { Accept: "text/x-component" }];
    for (const headers of flightHeaders) expect(h.request("/study", "cors", headers)).toBeUndefined();
    expect(h.request("/study", "cors")).toBeUndefined();
    expect(h.request("/study", "navigate", {}, "POST")).toBeUndefined();
  });

  it.each<Record<string, string>>([
    { "Cache-Control": "private, no-store" },
    { "Set-Cookie": "user=alice" },
    { Vary: "Cookie" },
    { "Content-Type": "text/x-component" },
  ])("rejects non-public shell responses: %j", async headers => {
    const h = harness();
    h.network.mockResolvedValueOnce(new Response("private", { headers: { "Content-Type": "text/html", ...headers } }));
    expect(await h.message()).toMatchObject({ ready: false });
    expect(await h.message("CHECK_APP_SHELL")).toMatchObject({ ready: false });
  });

  it("does not claim readiness after a redirect, mixed build or unavailable chunk", async () => {
    const redirect = harness();
    redirect.network.mockResolvedValueOnce(Response.redirect(origin + "/auth/login"));
    expect(await redirect.message()).toMatchObject({ ready: false });
    const mixed = harness();
    const original = mixed.network.getMockImplementation()!;
    mixed.network.mockImplementation(async (...args) => {
      const response = await original(...args);
      mixed.setBuild("build-two");
      return response;
    });
    expect(await mixed.message()).toMatchObject({ ready: false });
    const missing = harness();
    const serve = missing.network.getMockImplementation()!;
    missing.network.mockImplementation((input, options) => key(input).endsWith("lazy.js") ? Promise.resolve(new Response("not found", { status: 404 })) : serve(input, options));
    expect(await missing.message()).toMatchObject({ ready: false });
  });

  it("preserves a working shell during failed upgrades and retains old hashed assets", async () => {
    const h = harness();
    await h.message();
    h.setBuild("build-two");
    h.network.mockRejectedValueOnce(new Error("network"));
    expect(await h.message()).toMatchObject({ ready: false });
    expect(await h.message("CHECK_APP_SHELL")).toMatchObject({ ready: true, build: "build-one" });
    expect(await h.message()).toMatchObject({ ready: true, build: "build-two" });
    expect(h.stores.get("huella-static-v1")?.has(origin + "/_next/static/chunks/build-one.js")).toBe(true);
    h.network.mockRejectedValue(new TypeError("offline"));
    expect(await (await h.request("/study"))?.text()).toContain("build-two.js");
  });

  it("reports evicted required assets as unavailable", async () => {
    const h = harness();
    await h.message();
    h.stores.get("huella-static-v1")!.delete(origin + "/_next/static/media/font.woff2");
    expect(await h.message("CHECK_APP_SHELL")).toMatchObject({ ready: false });
  });

  it("retains explicitly downloaded media/range responses without intercepting other media", async () => {
    const h = harness();
    const media = "https://storage.test/storage/v1/object/public/audio/saved.mp3";
    const other = "https://storage.test/storage/v1/object/public/audio/other.mp3";
    h.network.mockResolvedValue(new Response("0123456789", { headers: { "Content-Type": "audio/mpeg" } }));
    await h.message("PRECACHE", [media]);
    h.network.mockRejectedValue(new TypeError("offline"));
    const partial = await h.request(media, "cors", { range: "bytes=2-4" });
    expect(partial?.status).toBe(206);
    expect(await partial?.text()).toBe("234");
    expect(h.request(other, "cors")).toBeUndefined();
  });

  it("refuses private/API URLs passed through the legacy media message", async () => {
    const h = harness();
    await h.message("PRECACHE", [origin + "/api/user/me", origin + "/account", "https://storage.test/storage/v1/object/sign/audio/private.mp3"]);
    expect(h.network).not.toHaveBeenCalled();
    expect(h.stores.get("huella-media-v2")?.size).toBe(0);
  });
});
