import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: mock.getUser } }) }));
import { updateSession } from "@/lib/supabase/middleware";
beforeEach(() => mock.getUser.mockResolvedValue({ data: { user: null } }));
describe("authentication boundary", () => {
  it.each(["/api/review", "/api/library", "/api/decks/other/view", "/api/stripe/credits", "/api/generate"])("returns JSON 401 for %s instead of a successful HTML sign-in page", async path => {
    const response = await updateSession(new NextRequest(`https://huella.test${path}`));
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
  it.each(["/decks/new", "/decks/abc/edit", "/generate"])("continues to protect server page %s", async path => {
    const response = await updateSession(new NextRequest(`https://huella.test${path}`));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/login");
  });
  it.each(["/api/stripe/webhook", "/api/cron/process-image-queue", "/api/landing/tts", "/api/stats?demo=1"])("leaves the dedicated authentication for %s intact", async path => {
    const response = await updateSession(new NextRequest(`https://huella.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
