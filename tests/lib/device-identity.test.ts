import { describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { DEVICE_IDENTITY_KEY, DEVICE_SIGN_OUT_KEY, observeDeviceIdentity, readDeviceIdentity, type DeviceIdentity } from "@/lib/device-identity";

function user(id: string): User {
  return { id, email: `${id}@example.test`, user_metadata: { name: id, full_name: `Learner ${id}`, avatar_url: "https://example.test/avatar?signed=secret", privateField: "secret" }, app_metadata: { privateField: "secret" }, aud: "authenticated", created_at: "2026-01-01" };
}
function session(id: string): Session {
  return { user: user(id), access_token: "access-secret", refresh_token: "refresh-secret", expires_in: 3600, token_type: "bearer" };
}
const result = (id: string | null, error: unknown = null) => ({ data: { session: id ? session(id) : null }, error });
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture({ saved = "alice", online = false, pending = Promise.resolve(result(null)), records = new Map<string, string>() }: { saved?: string | null; online?: boolean; pending?: Promise<ReturnType<typeof result>>; records?: Map<string, string> } = {}) {
  if (saved) records.set(DEVICE_IDENTITY_KEY, JSON.stringify({ version: 1, user: user(saved) }));
  const storage = {
    getItem: vi.fn((key: string) => records.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { records.set(key, value); }),
    removeItem: vi.fn((key: string) => { records.delete(key); }),
  };
  let callback!: (event: AuthChangeEvent, value: Session | null) => void;
  const unsubscribe = vi.fn();
  const getSession = vi.fn(() => pending);
  const signOut = vi.fn().mockResolvedValue({ error: new Error("offline") });
  const auth = {
    getSession,
    signOut,
    onAuthStateChange: vi.fn((listener: typeof callback) => { callback = listener; return { data: { subscription: { unsubscribe } } }; }),
  } as unknown as Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange" | "signOut">;
  const changes: DeviceIdentity[] = [];
  // Represents the legacy, unpartitioned sessionStorage resume snapshot.
  let resume: string | null = "alice-private-cards";
  const boundary = vi.fn(() => { resume = null; });
  const network = { online };
  const observer = observeDeviceIdentity({ auth, storage, online: () => network.online, onChange: value => changes.push(value), onAccountBoundary: boundary });
  return { observer, storage, records, getSession, signOut, unsubscribe, network, boundary, changes, emitSession: callback, emit: (event: AuthChangeEvent, id: string | null) => callback(event, id ? session(id) : null), current: () => changes.at(-1)!, resume: () => resume };
}

describe("saved device identity (not server authentication)", () => {
  it.each(["resolved error", "rejected promise", "never resolves"])("explicit logout clears immediately when Supabase %s, retaining pending reviews", async outcome => {
    const f = fixture();
    if (outcome === "rejected promise") f.signOut.mockRejectedValue(new TypeError("offline"));
    if (outcome === "never resolves") f.signOut.mockImplementation(() => new Promise(() => {}));
    f.records.set("account:alice:reviews", "pending-review");
    f.observer.signOut();
    expect(f.current()).toEqual({ user: null, source: null, ready: true });
    expect(f.resume()).toBeNull();
    expect(readDeviceIdentity(f.storage)).toBeNull();
    expect(f.records.get("account:alice:reviews")).toBe("pending-review");
    await tick();
    expect(f.signOut).toHaveBeenCalledOnce();
  });
  it("does not revive an explicitly signed-out account through stale refresh, SIGNED_IN recovery or reload", async () => {
    const f = fixture({ pending: Promise.resolve(result("alice")) });
    f.observer.signOut();
    for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"] as const) f.emit(event, "alice");
    f.network.online = true;
    await f.observer.refresh();
    expect(f.current().user).toBeNull();
    f.observer.dispose();
    const reloaded = fixture({ records: f.records, saved: null, online: true, pending: Promise.resolve(result("alice")) });
    await tick();
    reloaded.emit("SIGNED_IN", "alice");
    expect(reloaded.current().user).toBeNull();
    expect(reloaded.records.has(DEVICE_SIGN_OUT_KEY)).toBe(true);
  });
  it("permits an actual fresh sign-in after explicit logout without needing old tokens", () => {
    const f = fixture();
    f.observer.signOut();
    const fresh = session("bob");
    fresh.user.last_sign_in_at = new Date(Date.now() + 1000).toISOString();
    f.emitSession("SIGNED_IN", fresh);
    expect(f.current().user?.id).toBe("bob");
    expect(f.records.has(DEVICE_SIGN_OUT_KEY)).toBe(false);
  });
  it("compares server sign-in timestamps when the device clock is ahead", () => {
    const f = fixture();
    const old = session("alice");
    old.user.last_sign_in_at = "2026-01-01T00:00:00Z";
    f.emitSession("SIGNED_IN", old);
    f.observer.signOut();
    f.emitSession("TOKEN_REFRESHED", old);
    expect(f.current().user).toBeNull();
    const fresh = session("alice");
    fresh.user.last_sign_in_at = "2026-01-01T00:01:00Z";
    f.emitSession("SIGNED_IN", fresh);
    expect(f.current().user?.id).toBe("alice");
  });
  it("rejects the old session even if refresh contains a newer sign-in time from another device", () => {
    const f = fixture();
    const old = session("alice");
    const token = (id: string) => `header.${btoa(JSON.stringify({ session_id: id }))}.signature`;
    old.access_token = token("11111111-1111-1111-1111-111111111111");
    f.emitSession("SIGNED_IN", old);
    f.observer.signOut();
    old.user.last_sign_in_at = new Date(Date.now() + 1000).toISOString();
    f.emitSession("TOKEN_REFRESHED", old);
    f.emitSession("SIGNED_IN", old);
    expect(f.current().user).toBeNull();
    const fresh = { ...old, access_token: token("22222222-2222-2222-2222-222222222222") };
    f.emitSession("SIGNED_IN", fresh);
    expect(f.current().user?.id).toBe("alice");
    expect(f.records.get(DEVICE_IDENTITY_KEY)).not.toContain("signature");
  });
  it("does not release explicit logout for an expired session with a newer sign-in time", () => {
    const f = fixture();
    f.observer.signOut();
    const expired = session("alice");
    expired.user.last_sign_in_at = new Date(Date.now() + 1000).toISOString();
    expired.expires_at = Math.floor(Date.now() / 1000) - 1;
    f.emitSession("SIGNED_IN", expired);
    expect(f.current().user).toBeNull();
  });
  it("keeps an expired session as local identity, never as a usable sync session", async () => {
    const expired = result("alice");
    expired.data.session!.expires_at = Math.floor(Date.now() / 1000) - 60;
    const f = fixture({ online: true, pending: Promise.resolve(expired) });
    await tick();
    expect(f.current()).toMatchObject({ user: { id: "alice" }, source: "local" });
    f.emitSession("INITIAL_SESSION", expired.data.session);
    expect(f.current().source).toBe("local");
    expect(f.resume()).toBe("alice-private-cards");
  });
  it("opens the selected local partition immediately without an offline refresh", () => {
    const f = fixture();
    expect(f.current()).toMatchObject({ user: { id: "alice" }, ready: true, source: "local" });
    expect(f.getSession).not.toHaveBeenCalled();
    expect(f.resume()).toBe("alice-private-cards");
  });
  it("does not wait for a hanging online refresh before showing saved data", () => {
    const f = fixture({ online: true, pending: new Promise(() => {}) });
    expect(f.current().user?.id).toBe("alice");
    expect(f.current().source).toBe("local");
  });
  it("retains identity when INITIAL_SESSION(null) masks an offline refresh error", async () => {
    const f = fixture({ online: true, pending: Promise.resolve(result(null, new Error("fetch failed"))) });
    f.emit("INITIAL_SESSION", null);
    await tick();
    expect(f.current()).toMatchObject({ user: { id: "alice" }, source: "local" });
    expect(f.resume()).toBe("alice-private-cards");
  });
  it("retains identity when getSession throws", async () => {
    const f = fixture({ online: true, pending: Promise.reject(new TypeError("network failed")) });
    await tick();
    expect(f.current().user?.id).toBe("alice");
  });
  it("does not mistake a connection lost mid-refresh for a logout", async () => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    const f = fixture({ online: true, pending: new Promise(done => { resolve = done; }) });
    f.network.online = false;
    resolve(result(null));
    await tick();
    expect(f.current().user?.id).toBe("alice");
  });
  it("retains local study when cookies are absent and the interface falsely reports online", async () => {
    const f = fixture({ online: true });
    f.emit("INITIAL_SESSION", null);
    await tick();
    expect(f.current().user?.id).toBe("alice");
    expect(f.current().source).toBe("local");
    expect(readDeviceIdentity(f.storage)?.id).toBe("alice");
    expect(f.resume()).toBe("alice-private-cards");
  });
  it("clears explicit app sign-out even offline, without touching any account data", () => {
    const f = fixture();
    f.records.set("account:alice:reviews", "pending-review");
    f.observer.signOut();
    f.emit("SIGNED_OUT", null);
    f.emit("INITIAL_SESSION", null);
    expect(f.current().user).toBeNull();
    expect(f.resume()).toBeNull();
    expect(f.records.get("account:alice:reviews")).toBe("pending-review");
    expect(f.records.has(DEVICE_IDENTITY_KEY)).toBe(false);
  });
  it("switches partitions and clears the legacy resume without deleting saved study", () => {
    const f = fixture();
    f.records.set("account:alice:reviews", "pending-review");
    f.emit("SIGNED_IN", "bob");
    expect(f.current()).toMatchObject({ user: { id: "bob" }, source: "session" });
    expect(readDeviceIdentity(f.storage)?.id).toBe("bob");
    expect(f.resume()).toBeNull();
    expect(f.records.get("account:alice:reviews")).toBe("pending-review");
  });
  it("keeps same-account resume through token refresh", () => {
    const f = fixture();
    f.emit("TOKEN_REFRESHED", "alice");
    expect(f.boundary).not.toHaveBeenCalled();
    expect(f.resume()).toBe("alice-private-cards");
  });
  it.each(["SIGNED_OUT", "SIGNED_IN"] as const)("ignores stale getSession after %s", async event => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    const f = fixture({ online: true, pending: new Promise(done => { resolve = done; }) });
    if (event === "SIGNED_OUT") f.observer.signOut();
    f.emit(event, event === "SIGNED_IN" ? "bob" : null);
    resolve(result("alice"));
    await tick();
    expect(f.current().user?.id ?? null).toBe(event === "SIGNED_IN" ? "bob" : null);
    expect(readDeviceIdentity(f.storage)?.id ?? null).toBe(event === "SIGNED_IN" ? "bob" : null);
  });
  it("reconciles with the real client session when connectivity returns", async () => {
    const f = fixture({ pending: Promise.resolve(result("bob")) });
    f.network.online = true;
    await f.observer.refresh();
    expect(f.current()).toMatchObject({ user: { id: "bob" }, source: "session" });
    expect(f.resume()).toBeNull();
  });
  it("stores only allowlisted display fields, never credentials or arbitrary metadata", () => {
    const f = fixture();
    f.emit("SIGNED_IN", "bob");
    expect(JSON.parse(f.records.get(DEVICE_IDENTITY_KEY)!)).toEqual({ version: 1, user: { id: "bob", email: "bob@example.test", user_metadata: { name: "bob", full_name: "Learner bob" } } });
    expect(f.records.get(DEVICE_IDENTITY_KEY)).not.toContain("secret");
  });
  it("fails closed for malformed/version-mismatched storage", () => {
    for (const value of ["not-json", "null", "{}", JSON.stringify({ version: 2, user: user("alice") }), JSON.stringify({ version: 1, user: { id: "" } })]) {
      expect(readDeviceIdentity({ getItem: () => value, setItem: vi.fn(), removeItem: vi.fn() })).toBeNull();
    }
  });
  it("does not invent a user when no saved identity or auth is available", () => {
    const f = fixture({ saved: null });
    expect(f.current()).toEqual({ user: null, source: null, ready: true });
    expect(f.resume()).toBeNull();
  });
  it("handles cross-tab sign-out and rejects an in-flight old account result", async () => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    const f = fixture({ online: true, pending: new Promise(done => { resolve = done; }) });
    f.records.delete(DEVICE_IDENTITY_KEY);
    f.observer.reloadSavedIdentity();
    resolve(result("alice"));
    await tick();
    expect(f.current().user).toBeNull();
    expect(f.resume()).toBeNull();
  });
  it("does not retain Alice's selection when saving Bob exceeds storage quota", () => {
    const f = fixture();
    f.storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    f.emit("SIGNED_IN", "bob");
    expect(f.current().user?.id).toBe("bob");
    expect(readDeviceIdentity(f.storage)).toBeNull();
  });
  it("still clears in-memory identity when storage access is denied", () => {
    const f = fixture();
    f.storage.removeItem.mockImplementation(() => { throw new Error("denied"); });
    f.observer.signOut();
    f.emit("SIGNED_OUT", null);
    expect(f.current().user).toBeNull();
    expect(f.resume()).toBeNull();
  });
  it("unsubscribes and ignores late results after unmount", async () => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    const f = fixture({ online: true, pending: new Promise(done => { resolve = done; }) });
    f.observer.dispose();
    resolve(result("bob"));
    f.emit("SIGNED_IN", "bob");
    await tick();
    expect(f.current().user?.id).toBe("alice");
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('reconnect signalling',()=>{
 it('does not ask for sign-in while restoration is pending or storage/network fails',async()=>{
  const pending=fixture({online:true,pending:new Promise(()=>{})});expect(pending.current().reconnectRequired).toBeUndefined();pending.observer.dispose();
  const failed=fixture({online:true,pending:Promise.resolve(result(null,new Error('storage unavailable')))});await failed.observer.refresh();expect(failed.current().reconnectRequired).toBeUndefined();expect(failed.current().user?.id).toBe('alice');failed.observer.dispose();
 });
 it('asks for reconnection only after a successful session read confirms absence',async()=>{
  const f=fixture({online:true});await f.observer.refresh();expect(f.current().reconnectRequired).toBe(true);f.emit('SIGNED_IN','alice');expect(f.current().reconnectRequired).toBeUndefined();f.observer.dispose();
 });
});


describe("credential loss does not discard the offline account", () => {
  it.each([false, true])("retains library, resume and pending reviews on SDK SIGNED_OUT (online=%s)", async online => {
    const f = fixture({ online, pending: new Promise(() => {}) });
    f.records.set("account:alice:reviews", "pending-review");
    f.emit("SIGNED_OUT", null);
    expect(f.current()).toMatchObject({ user: { id: "alice" }, source: "local" });
    expect(f.current().reconnectRequired).toBe(online ? true : undefined);
    expect(f.resume()).toBe("alice-private-cards");
    expect(f.records.get("account:alice:reviews")).toBe("pending-review");
    expect(readDeviceIdentity(f.storage)?.id).toBe("alice");
    expect(f.boundary).not.toHaveBeenCalled();
    f.observer.dispose();
    const reopened = fixture({ saved: null, records: f.records });
    expect(reopened.current().user?.id).toBe("alice");
    reopened.network.online = true;
    reopened.getSession.mockResolvedValue(result("alice"));
    await reopened.observer.refresh();
    expect(reopened.current()).toMatchObject({ user: { id: "alice" }, source: "session" });
    expect(reopened.current().reconnectRequired).toBeUndefined();
    expect(reopened.records.get("account:alice:reviews")).toBe("pending-review");
    reopened.observer.dispose();
  });
  it("ignores a stale session response after an SDK sign-out without losing local identity", async () => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    const f = fixture({ online: true, pending: new Promise(done => { resolve = done; }) });
    f.emit("SIGNED_OUT", null);
    resolve(result("alice"));
    await tick();
    expect(f.current()).toMatchObject({ user: { id: "alice" }, source: "local", reconnectRequired: true });
  });
  it("respects another tab's explicit logout fence on SDK sign-out", () => {
    const f = fixture();
    f.records.set(DEVICE_SIGN_OUT_KEY, JSON.stringify({ at: Date.now() }));
    f.emit("SIGNED_OUT", null);
    expect(f.current().user).toBeNull();
    expect(f.resume()).toBeNull();
  });
});
