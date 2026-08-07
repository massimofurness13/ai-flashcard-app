import { describe, it, expect, beforeEach, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  isModelUnavailable,
  resolveFallbackModel,
  createWithModelFallback,
  __resetModelCache,
} from "../../src/lib/claude";

// A minimal stand-in for the Anthropic client — just the two surfaces the
// fallback logic touches. Cast to Anthropic at the call site.
function mockClient(opts: {
  models?: Array<{ id: string; created_at: string }>;
  createImpl?: (params: { model: string }) => Promise<unknown>;
}) {
  return {
    models: {
      list: vi.fn(async () => ({ data: opts.models ?? [] })),
    },
    messages: {
      create: vi.fn(opts.createImpl ?? (async () => ({ content: [] }))),
    },
  } as unknown as Anthropic;
}

// Anthropic's SDK 404 shape: a NotFoundError carries `status: 404`.
function notFound() {
  return Object.assign(new Error("404 model: not_found_error"), { status: 404 });
}

const MODELS = [
  { id: "claude-sonnet-5", created_at: "2026-01-15T00:00:00Z" },
  { id: "claude-sonnet-4-6", created_at: "2025-11-01T00:00:00Z" },
  { id: "claude-opus-5", created_at: "2026-02-01T00:00:00Z" },
  { id: "claude-haiku-4-5", created_at: "2025-10-01T00:00:00Z" },
];

beforeEach(() => {
  __resetModelCache();
});

describe("isModelUnavailable", () => {
  it("is true for a 404 status", () => {
    expect(isModelUnavailable(notFound())).toBe(true);
  });
  it("is true when the error type is not_found_error", () => {
    expect(isModelUnavailable({ error: { error: { type: "not_found_error" } } })).toBe(true);
  });
  it("is true when the message says the model was not found", () => {
    expect(isModelUnavailable(new Error("model: claude-x not found"))).toBe(true);
  });
  it("is false for a rate limit (429)", () => {
    expect(isModelUnavailable(Object.assign(new Error("rate"), { status: 429 }))).toBe(false);
  });
  it("is false for an unrelated error", () => {
    expect(isModelUnavailable(new Error("network blip"))).toBe(false);
  });
});

describe("resolveFallbackModel", () => {
  it("picks the NEWEST Sonnet when Sonnet models exist", async () => {
    const client = mockClient({ models: MODELS });
    expect(await resolveFallbackModel(client)).toBe("claude-sonnet-5");
  });

  it("falls back to the newest Opus when no Sonnet is available", async () => {
    const client = mockClient({
      models: [
        { id: "claude-opus-5", created_at: "2026-02-01T00:00:00Z" },
        { id: "claude-opus-4-8", created_at: "2025-12-01T00:00:00Z" },
        { id: "claude-haiku-4-5", created_at: "2025-10-01T00:00:00Z" },
      ],
    });
    expect(await resolveFallbackModel(client)).toBe("claude-opus-5");
  });

  it("falls back to the newest model of any kind if no preferred family exists", async () => {
    const client = mockClient({
      models: [{ id: "claude-future-9", created_at: "2027-01-01T00:00:00Z" }],
    });
    expect(await resolveFallbackModel(client)).toBe("claude-future-9");
  });

  it("throws when the account has no models at all", async () => {
    const client = mockClient({ models: [] });
    await expect(resolveFallbackModel(client)).rejects.toThrow();
  });
});

describe("createWithModelFallback", () => {
  it("uses the primary model when it works (no Models API call)", async () => {
    const client = mockClient({
      models: MODELS,
      createImpl: async ({ model }) => ({ content: [{ type: "text", text: model }] }),
    });
    const res = await createWithModelFallback(client, {
      max_tokens: 10,
      messages: [{ role: "user", content: "hi" }],
    });
    // First (only) call used the hardcoded primary, claude-sonnet-5.
    expect((client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0].model).toBe(
      "claude-sonnet-5",
    );
    expect(client.models.list).not.toHaveBeenCalled();
    expect(res.content[0]).toMatchObject({ text: "claude-sonnet-5" });
  });

  it("resolves a live replacement and retries when the primary is retired", async () => {
    let calls = 0;
    const client = mockClient({
      // Newest available is opus-5 (sonnet-5 has been 'retired' — it's not
      // in this list, so resolveFallbackModel won't pick it).
      models: [
        { id: "claude-opus-5", created_at: "2026-05-01T00:00:00Z" },
        { id: "claude-sonnet-4-6", created_at: "2025-11-01T00:00:00Z" },
      ],
      createImpl: async ({ model }) => {
        calls += 1;
        if (calls === 1) throw notFound(); // primary (sonnet-5) is gone
        return { content: [{ type: "text", text: model }] };
      },
    });

    const res = await createWithModelFallback(client, {
      max_tokens: 10,
      messages: [{ role: "user", content: "hi" }],
    });

    // Retried on the newest Sonnet available (4-6), not the retired 5.
    expect(res.content[0]).toMatchObject({ text: "claude-sonnet-4-6" });
    expect(client.models.list).toHaveBeenCalledOnce();
    expect(calls).toBe(2);
  });

  it("does NOT fall back on a non-model error (e.g. rate limit)", async () => {
    const client = mockClient({
      models: MODELS,
      createImpl: async () => {
        throw Object.assign(new Error("rate limited"), { status: 429 });
      },
    });
    await expect(
      createWithModelFallback(client, {
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("rate limited");
    expect(client.models.list).not.toHaveBeenCalled();
  });
});
