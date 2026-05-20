/* eslint-disable no-console */
/**
 * Stripe configuration diagnostics. Run locally with:
 *
 *   npx tsx scripts/check-stripe.ts
 *
 * Set the same env vars you'd put on Render in your shell first (or
 * load them from .env — the script reads process.env directly):
 *
 *   export STRIPE_SECRET_KEY=sk_live_...
 *   export STRIPE_PRICE_ID_MONTHLY=price_...   # or STRIPE_PRICE_ID (legacy)
 *   export STRIPE_PRICE_ID_YEARLY=price_...
 *
 * The script does four things:
 *   1. Reports which mode your secret key is in (test / live).
 *   2. Tries to retrieve each configured price ID — tells you
 *      whether Stripe recognises it or returns "No such price".
 *   3. Lists every active product + price in the account so you
 *      can see the correct IDs to copy back into Render.
 *   4. Tries to create a dummy Checkout Session with each valid
 *      price — proves end-to-end that a real upgrade click would
 *      succeed.
 *
 * No transactions are made. No customer is created. Nothing
 * touches the database. Safe to run as often as you want.
 */

import Stripe from "stripe";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function header(s: string): void {
  console.log(`\n${BLUE}━━ ${s} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
}

function ok(s: string): void {
  console.log(`${GREEN}  ✓${RESET} ${s}`);
}

function bad(s: string): void {
  console.log(`${RED}  ✗${RESET} ${s}`);
}

function info(s: string): void {
  console.log(`${DIM}    ${s}${RESET}`);
}

function warn(s: string): void {
  console.log(`${YELLOW}  !${RESET} ${s}`);
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  const monthly =
    process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID || "";
  const yearly = process.env.STRIPE_PRICE_ID_YEARLY || "";

  header("Env vars");
  if (!key) {
    bad("STRIPE_SECRET_KEY is not set. Stop here and add it.");
    process.exit(1);
  }
  const mode = key.startsWith("sk_live_")
    ? "LIVE"
    : key.startsWith("sk_test_")
      ? "TEST"
      : "UNKNOWN";
  const keyTail = key.slice(-6);
  ok(`STRIPE_SECRET_KEY: ${mode} mode (…${keyTail})`);
  if (mode === "UNKNOWN") {
    warn("Key doesn't start with sk_live_ or sk_test_. That's unusual.");
  }
  if (monthly) ok(`STRIPE_PRICE_ID_MONTHLY: ${monthly}`);
  else bad("STRIPE_PRICE_ID_MONTHLY (or STRIPE_PRICE_ID) is not set.");
  if (yearly) ok(`STRIPE_PRICE_ID_YEARLY:  ${yearly}`);
  else warn("STRIPE_PRICE_ID_YEARLY is not set — Yearly plan checkout will fail.");

  const stripe = new Stripe(key);

  // ── Validate the configured price IDs against Stripe ───────────
  header("Configured price IDs vs Stripe");
  const configured: Array<{ envVar: string; id: string }> = [];
  if (monthly) configured.push({ envVar: "MONTHLY", id: monthly });
  if (yearly) configured.push({ envVar: "YEARLY", id: yearly });

  const validIds: string[] = [];
  for (const { envVar, id } of configured) {
    try {
      const price = await stripe.prices.retrieve(id);
      const amount = (price.unit_amount ?? 0) / 100;
      const currency = price.currency.toUpperCase();
      const interval = price.recurring?.interval ?? "one-time";
      const active = price.active ? GREEN + "active" + RESET : RED + "ARCHIVED" + RESET;
      ok(`${envVar}: ${id}`);
      info(`amount: ${amount} ${currency} / ${interval}    status: ${active}`);
      if (!price.active) {
        warn(
          `This price is ARCHIVED in Stripe. New checkouts against it will be rejected.`,
        );
      } else {
        validIds.push(id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      bad(`${envVar}: ${id} — ${message}`);
    }
  }

  // ── List every product + price in the Stripe account ───────────
  header("All products + prices in this Stripe account");
  const products = await stripe.products.list({ limit: 50, active: true });
  if (products.data.length === 0) {
    warn("No active products found. Create a Pro product in Stripe first.");
  }
  for (const product of products.data) {
    console.log(`\n  ${BLUE}${product.name}${RESET}    ${DIM}${product.id}${RESET}`);
    const prices = await stripe.prices.list({
      product: product.id,
      limit: 50,
      active: true,
    });
    if (prices.data.length === 0) {
      info("(no active prices)");
      continue;
    }
    for (const price of prices.data) {
      const amount = (price.unit_amount ?? 0) / 100;
      const currency = price.currency.toUpperCase();
      const interval = price.recurring
        ? `/${price.recurring.interval}`
        : " one-time";
      const isConfigured = price.id === monthly || price.id === yearly;
      const tag = isConfigured ? ` ${GREEN}← in Render${RESET}` : "";
      console.log(
        `    ${price.id}    ${amount} ${currency}${interval}${tag}`,
      );
    }
  }

  // ── Smoke-test: create a Checkout Session with each valid price
  header("Smoke test — can we create a Checkout Session?");
  if (validIds.length === 0) {
    bad("Skipped. No valid price IDs to test with. Fix the env vars first.");
  } else {
    for (const id of validIds) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: id, quantity: 1 }],
          success_url: "https://example.com/done",
          cancel_url: "https://example.com/cancel",
        });
        ok(`Session created for ${id}`);
        info(`url: ${session.url?.slice(0, 80)}…`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        bad(`${id}: ${message}`);
      }
    }
  }

  // ── Final verdict ──────────────────────────────────────────────
  header("Verdict");
  const monthlyOk = monthly && validIds.includes(monthly);
  const yearlyOk = yearly && validIds.includes(yearly);
  if (monthlyOk && yearlyOk) {
    ok("Both Monthly and Yearly checkouts are configured correctly.");
    console.log(
      `\n${GREEN}If the live site is still throwing 'No such price', it means Render hasn't picked up the latest env-var values — trigger a manual redeploy.${RESET}\n`,
    );
  } else {
    if (!monthlyOk) {
      bad("Monthly checkout WILL fail. Set STRIPE_PRICE_ID_MONTHLY to one of the price IDs listed above.");
    }
    if (!yearlyOk) {
      bad("Yearly checkout WILL fail. Set STRIPE_PRICE_ID_YEARLY to one of the price IDs listed above.");
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(`${RED}fatal:${RESET}`, err);
  process.exit(1);
});
