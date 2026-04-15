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

export const PRICE_ID = process.env.STRIPE_PRICE_ID || "";
export const PRO_PRICE = 6.99;
