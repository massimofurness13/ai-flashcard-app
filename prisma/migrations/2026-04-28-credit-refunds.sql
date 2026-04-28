-- FlashMind: track credit purchase refunds
--
-- Stripe's charge.refunded webhook fires when a payment is refunded.
-- Without a place to mark which purchases have been refunded, we
-- can't be idempotent — repeated webhook deliveries would
-- decrement the user's credits multiple times. The refundedAt
-- timestamp doubles as both audit trail and idempotency key.
ALTER TABLE "CreditPurchase"
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
