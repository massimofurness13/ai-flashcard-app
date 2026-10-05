import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeAuthReturn, safeAuthRedirect, authErrorMessage } from "@/lib/native-auth";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/public-origin", () => ({ getPublicOrigin: () => "https://huella.example" }));
import { GET } from "@/app/auth/callback/route";
const state = "12345678-1234-1234-1234-123456789abc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.client.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange } });
});

describe("native OAuth return", () => {
  it("returns only the code and state to the fixed app scheme, without exchanging in Safari", async () => {
    const response = await GET(new Request(`https://huella.example/auth/callback?native=1&native_state=${state}&code=one-time-code&redirectTo=https://evil.example&access_token=secret`));
    const target = new URL(response.headers.get("location")!);
    expect(target.protocol).toBe("app.huella.auth:");
    expect(target.host).toBe("auth");
    expect(target.pathname).toBe("/callback");
    expect([...target.searchParams]).toEqual([["state", state], ["code", "one-time-code"]]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["", "attacker", "https://evil.example"]) ("rejects malformed correlation state %s", async value => {
    const response = await GET(new Request(`https://huella.example/auth/callback?native=1&native_state=${encodeURIComponent(value)}&code=code`));
    expect(response.headers.get("location")).toBe("https://huella.example/auth/login?error=callback_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it.each(["error=access_denied", "", "code=a&code=b", `code=${"x".repeat(2049)}`, "code=a&error=denied"])("returns provider failure to the app: %s", query => {
    const result = nativeAuthReturn(new URLSearchParams(`native=1&native_state=${state}&${query}`))!;
    expect(result.searchParams.get("error")).toBe("callback_failed");
    expect(result.searchParams.has("code")).toBe(false);
  });
  it("exchanges normally after the app reloads its HTTPS callback", async () => {
    const response = await GET(new Request("https://huella.example/auth/callback?code=code&redirectTo=/study"));
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith("code");
    expect(response.headers.get("location")).toBe("https://huella.example/study");
  });
  it("shows a retryable login error on PKCE failure", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "invalid verifier" } });
    const response = await GET(new Request("https://huella.example/auth/callback?code=code"));
    expect(response.headers.get("location")).toContain("error=callback_failed");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil", "javascript:alert(1)"])("rejects unsafe redirect %s", value => {
    expect(safeAuthRedirect(value)).toBe("/");
  });
  it("preserves safe in-app paths", () => {
    expect(safeAuthRedirect("/study?deck=abc")).toBe("/study?deck=abc");
  });
  it.each(["native_cancelled", "native_timeout", "native_failed", "callback_failed"])("explains recoverable error %s", code => {
    expect(authErrorMessage(code)).not.toBe("");
  });
  it("never reflects arbitrary provider messages", () => {
    expect(authErrorMessage("attacker content")).toBe("");
  });
});
