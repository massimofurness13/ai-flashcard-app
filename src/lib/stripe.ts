import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your .env file."
      );
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — kept for convenience */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Monthly Pro subscription — $8.99/mo
// Priced above the indie-SaaS comfort zone because AI image generation
// + native-speaker TTS is a genuine moat. Once a user has 500+
// illustrated cards they've built mastery on, churning back to plain
// text flashcards has real switching cost.
export const PRICE_ID = process.env.STRIPE_PRICE_ID || "";
export const PRO_PRICE = 8.99;

// Yearly Pro subscription — $79.99/yr (~26% off monthly, "three months free")
// All 6,000 credits unlocked upfront so users porting an Anki library
// can illustrate everything in one go without throttling. Top-up
// purchases still stack on top and never expire.
export const PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY || "";
export const PRO_PRICE_YEARLY = 79.99;

export type SubscriptionPlan = "monthly" | "yearly";

/**
 * Map a Stripe price ID back to our internal plan label. Used by the
 * webhook so we never have to encode the plan in checkout metadata —
 * the source of truth is which price the user was actually charged.
 */
export function planFromPriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (priceId && PRICE_ID_YEARLY && priceId === PRICE_ID_YEARLY) return "yearly";
  return "monthly";
}
