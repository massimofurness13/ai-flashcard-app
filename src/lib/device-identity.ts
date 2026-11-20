import type { Session, SupabaseClient } from "@supabase/supabase-js";

// This is a pointer to this device's account partition, NEVER a credential or
// proof of server authentication. Do not persist sessions, tokens or arbitrary
// user/app metadata here. Server requests still require normal Supabase auth.
export interface DeviceUser {
  id: string;
  email?: string;
  last_sign_in_at?: string;
  user_metadata: { name?: string; full_name?: string; avatar_url?: string };
}
export interface DeviceIdentity {
  user: DeviceUser | null;
  ready: boolean;
  source: "local" | "session" | null;
  reconnectRequired?: true;
}
export const DEVICE_IDENTITY_KEY = "huella:device-identity:v1";
export const DEVICE_SIGN_OUT_KEY = "huella:device-sign-out:v1";
type IdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type IdentityAuth = Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange" | "signOut">;
type SignOutFence = { at: number; previousSignInAt?: string; sessionId?: string };
function sessionId(session: Session): string | undefined {
  try {
    // Keep only the non-secret session UUID, never the token. This is merely a
    // logout comparison marker, not JWT verification or permission to call APIs.
    const payload = JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.session_id === "string" && /^[\da-f-]{36}$/i.test(payload.session_id) ? payload.session_id : undefined;
  } catch { return undefined; }
}
function savedSessionId(storage: IdentityStorage | null): string | undefined {
  try {
    const value = JSON.parse(storage?.getItem(DEVICE_IDENTITY_KEY) ?? "null")?.sessionId;
    return typeof value === "string" && /^[\da-f-]{36}$/i.test(value) ? value : undefined;
  } catch { return undefined; }
}
function readSignOutFence(storage: IdentityStorage | null): SignOutFence | null {
  try {
    const value = storage?.getItem(DEVICE_SIGN_OUT_KEY);
    if (!value) return null;
    const fence = JSON.parse(value);
    return typeof fence.at === "number" && fence.at > 0 ? fence : { at: Infinity };
  } catch { return null; }
}

function displayUser(value: unknown): DeviceUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  if (typeof user.id !== "string" || !user.id.trim() || user.id.length > 256) return null;
  const metadata = user.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === "string" && value.length <= 1024 ? value : undefined;
  return {
    id: user.id,
    ...(text(user.email) !== undefined ? { email: text(user.email) } : {}),
    ...(text(user.last_sign_in_at) !== undefined ? { last_sign_in_at: text(user.last_sign_in_at) } : {}),
    user_metadata: {
      ...(text(metadata.name) !== undefined ? { name: text(metadata.name) } : {}),
      ...(text(metadata.full_name) !== undefined ? { full_name: text(metadata.full_name) } : {}),
    },
  };
}

export function readDeviceIdentity(storage: IdentityStorage | null): DeviceUser | null {
  try {
    if (readSignOutFence(storage)) return null;
    const saved = JSON.parse(storage?.getItem(DEVICE_IDENTITY_KEY) ?? "null");
    return saved?.version === 1 ? displayUser(saved.user) : null;
  } catch { return null; }
}

/** Restore immediately, without waiting for an expired session's network refresh. */
export function observeDeviceIdentity({ auth, storage, online, onChange, onAccountBoundary }: {
  auth: IdentityAuth;
  storage: IdentityStorage | null;
  online: () => boolean;
  onChange: (identity: DeviceIdentity) => void;
  onAccountBoundary?: () => void;
}) {
  let active = true;
  let revision = 0;
  let signedOut = readSignOutFence(storage);
  let currentSessionId = savedSessionId(storage);
  let current = readDeviceIdentity(storage);
  const publish = (user: DeviceUser | null, source: DeviceIdentity["source"], reconnectRequired=false) => {
    if (current?.id !== user?.id) onAccountBoundary?.();
    current = user;
    onChange({ user, source: user ? source : null, ready: true, ...(user&&reconnectRequired?{reconnectRequired:true as const}:{}) });
  };
  const remember = (user: DeviceUser | null) => {
    try {
      if (user) {
        // On a quota failure, do not leave the previous account selected.
        if (readDeviceIdentity(storage)?.id !== user.id) storage?.removeItem(DEVICE_IDENTITY_KEY);
        storage?.setItem(DEVICE_IDENTITY_KEY, JSON.stringify({ version: 1, user: displayUser(user), ...(currentSessionId ? { sessionId: currentSessionId } : {}) }));
      }
      else storage?.removeItem(DEVICE_IDENTITY_KEY);
    } catch { /* Storage denial must not block sign-in or in-memory sign-out. */ }
  };
  if (!current) onAccountBoundary?.();
  publish(current, "local");
  const acceptSession = (session: Session) => {
    const user = displayUser(session.user);
    const nextSessionId = sessionId(session);
    const expired = session.expires_at !== undefined && session.expires_at * 1000 <= Date.now();
    const fence = signedOut ?? readSignOutFence(storage);
    if (fence) {
      // SIGNED_IN can also be emitted by session recovery. Only a genuinely
      // newer sign-in may release an explicit logout, never a token refresh.
      const previous = Date.parse(fence.previousSignInAt ?? "");
      const next = Date.parse(user?.last_sign_in_at ?? "");
      // A refreshed old JWT can contain updated user metadata (for example
      // after a sign-in on another device); its session UUID stays the same.
      if (expired || (fence.sessionId
        ? !nextSessionId || nextSessionId === fence.sessionId
        : !Number.isFinite(next) || next <= (Number.isFinite(previous) ? previous : fence.at))) return;
      signedOut = null;
      try { storage?.removeItem(DEVICE_SIGN_OUT_KEY); } catch { /* In-memory sign-in still works. */ }
    }
    currentSessionId = nextSessionId;
    remember(user);
    // Avatars are memory-only: external URLs may contain signed query strings.
    if (user && typeof session.user.user_metadata?.avatar_url === "string") user.user_metadata.avatar_url = session.user.user_metadata.avatar_url;
    publish(user, expired ? "local" : "session");
  };
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!active) return;
    if (event === "SIGNED_OUT") {
      revision++;
      remember(null);
      if (!current) onAccountBoundary?.();
      publish(null, null);
    } else if (session?.user) {
      revision++;
      acceptSession(session);
    }
    // INITIAL_SESSION(null) is ambiguous: cookies may be absent while this
    // device still has a saved offline account. Explicit logout clears it.
  });

  async function refresh() {
    if (!active || !online()) return;
    const requestRevision = ++revision;
    try {
      const { data, error } = await auth.getSession();
      if (!active || requestRevision !== revision) return;
      if (error || (!data.session && !online())) {
        publish(current, "local");
        return;
      }
      if (data.session) acceptSession(data.session);
      // getSession can return null without making a network request. Even
      // navigator.onLine=true only proves a network interface exists, not that
      // Supabase is reachable. Keep the local partition; it grants no server
      // access. Only explicit sign-out or SIGNED_OUT clears this identity.
      else publish(current, "local",true);
    } catch {
      if (active && requestRevision === revision) publish(current, "local");
    }
  }
  void refresh();
  return {
    refresh,
    signOut() {
      if (!active) return;
      revision++;
      signedOut = { at: Date.now(), ...(current?.last_sign_in_at ? { previousSignInAt: current.last_sign_in_at } : {}), ...(currentSessionId ? { sessionId: currentSessionId } : {}) };
      try { storage?.setItem(DEVICE_SIGN_OUT_KEY, JSON.stringify(signedOut)); } catch { /* Keep the in-memory fence. */ }
      remember(null);
      if (!current) onAccountBoundary?.();
      publish(null, null);
      // No wait: Supabase may return a network error without emitting SIGNED_OUT.
      // It remains responsible for credential cleanup; we never copy credentials.
      void auth.signOut().catch(() => {});
    },
    // Storage events carry sign-out/account switches from another tab. Invalidate
    // pending session reads so account A cannot overwrite account B's partition.
    reloadSavedIdentity() {
      if (!active) return;
      revision++;
      signedOut = readSignOutFence(storage);
      currentSessionId = savedSessionId(storage);
      publish(readDeviceIdentity(storage), "local");
    },
    dispose() { active = false; revision++; data.subscription.unsubscribe(); },
  };
}
