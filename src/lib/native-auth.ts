// Only a short-lived PKCE code travels through this fixed native callback.
// Never exchange it in Safari: the verifier cookie belongs to the app WebView.
export function nativeAuthReturn(params: URLSearchParams): URL | null {
  if (params.get("native") !== "1") return null;
  const state = params.get("native_state") || "";
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(state)) return null;
  const result = new URL("app.huella.auth://auth/callback");
  result.searchParams.set("state", state);
  const code = params.get("code");
  if (code && code.length <= 2048 && params.getAll("code").length === 1 && !params.has("error")) {
    result.searchParams.set("code", code);
  } else {
    result.searchParams.set("error", "callback_failed");
  }
  return result;
}

export function safeAuthRedirect(value: string | null): string {
  // Reject absolute, protocol-relative and backslash-normalized URLs.
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/";
  return value;
}

export function authErrorMessage(code: string | null): string {
  if (code === "native_cancelled") return "Sign-in was cancelled. You can try again.";
  if (code === "native_timeout") return "Sign-in timed out. Please try again.";
  if (code === "native_failed" || code === "callback_failed") return "We couldn’t finish signing you in. Please try again.";
  return "";
}
