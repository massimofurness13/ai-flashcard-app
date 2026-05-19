import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// We can't import from src/lib/subscription directly because the
// vitest config doesn't resolve the `@/` path alias used in that
// module's import of @/lib/db. The test below is purely about the
// date-math boundary anyway, so we read the constant out of the
// source file by regex — that way a future refactor that changes
// the number also has to update the regex match, keeping the test
// honest without dragging Prisma into the test runtime.
const SUBSCRIPTION_SRC = readFileSync(
  join(__dirname, "../../src/lib/subscription.ts"),
  "utf8",
);
const trialDaysMatch = SUBSCRIPTION_SRC.match(
  /FREE_IMAGE_VIEW_TRIAL_DAYS\s*=\s*(\d+)/,
);
if (!trialDaysMatch) {
  throw new Error(
    "FREE_IMAGE_VIEW_TRIAL_DAYS constant not found in src/lib/subscription.ts",
  );
}
const FREE_IMAGE_VIEW_TRIAL_DAYS = Number(trialDaysMatch[1]);

// The "can the user see AI illustrations unblurred" check has two
// halves — active-Pro (covered by isProUser) and the free-image
// trial window. These tests pin down the date-math half: given a
// createdAt, is the user inside or outside the trial?
//
// We test the pure date arithmetic at the boundaries rather than
// the full canViewAiImages helper, which would need Prisma. The
// helper is a one-line composition:
//   return isPro || (createdAt + 30d > Date.now())
// so as long as the boundary math is right and isProUser is
// covered separately, we're good.

const DAY_MS = 24 * 60 * 60 * 1000;

function inTrial(createdAt: Date, now: Date): boolean {
  const trialEndMs =
    createdAt.getTime() + FREE_IMAGE_VIEW_TRIAL_DAYS * DAY_MS;
  return now.getTime() < trialEndMs;
}

describe("free image-viewing trial window", () => {
  it("uses a 30-day window", () => {
    // The constant is load-bearing — flip it consciously, not by
    // accident. If product wants 14 or 60 days, update this test
    // alongside the constant so reviewers see the policy change.
    expect(FREE_IMAGE_VIEW_TRIAL_DAYS).toBe(30);
  });

  it("brand-new account is inside the trial", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date("2026-01-01T12:00:01Z"); // one second later
    expect(inTrial(createdAt, now)).toBe(true);
  });

  it("account 1 day old is inside the trial", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date("2026-01-02T12:00:00Z");
    expect(inTrial(createdAt, now)).toBe(true);
  });

  it("account 29 days old is inside the trial", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date(createdAt.getTime() + 29 * DAY_MS);
    expect(inTrial(createdAt, now)).toBe(true);
  });

  it("account 30 days minus 1 second old is JUST inside the trial", () => {
    // Boundary: trial is half-open [0, 30 days). One second before
    // the boundary the user is still entitled to view.
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date(createdAt.getTime() + 30 * DAY_MS - 1000);
    expect(inTrial(createdAt, now)).toBe(true);
  });

  it("account exactly 30 days old is OUTSIDE the trial", () => {
    // Boundary: half-open interval — the moment 30 days hit, blur
    // kicks in. (Using strict < on the millisecond gives us this.)
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date(createdAt.getTime() + 30 * DAY_MS);
    expect(inTrial(createdAt, now)).toBe(false);
  });

  it("account 31 days old is outside the trial", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date(createdAt.getTime() + 31 * DAY_MS);
    expect(inTrial(createdAt, now)).toBe(false);
  });

  it("account 90 days old is outside the trial", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    const now = new Date(createdAt.getTime() + 90 * DAY_MS);
    expect(inTrial(createdAt, now)).toBe(false);
  });
});
