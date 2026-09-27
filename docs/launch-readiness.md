# Huella launch readiness

Last checked: 27 September 2026. This is an evidence log, not a declaration that the app is ready.

## Product decisions pending

- User proposes £3.99/month, later describes $4.99/month, with images bought separately as one-time credit purchases. Asked whether to offer GBP, USD or both; no answer yet.
- Current free tier already offers essentially all study features. Asked which features the new subscription unlocks. Do not silently put previously free features behind a paywall.
- Existing subscribers must retain the allowances they bought (500/month or 6,000/year). New pricing needs distinct Stripe prices and a distinct entitlement policy. Merely changing price labels would be wrong.
- Generated images remain accessible after cancellation. Current branch implements this for all retained illustrations, including starter-credit images. Pack ownership checks remain required.

## Verified baseline

- The production Render URL configured in capacitor.config.ts served build 3738969 at audit start.
- Google OAuth worked in the user's Chrome, returning to the existing account and a library of 1,120 cards. No password or new permission was needed.
- Local production build passes. Baseline tests: 406. Replaced eight mirrored date-math tests with four tests of actual quota/access functions and added eight actual queue-route tests: 410 passing.
- TypeScript passes; targeted lint has existing warnings for unused isPro and an img element, no errors.
- No live payments, subscription migrations or image generation performed during the initial audit.

## Initial fixes prepared

- Text-card autosave no longer stamps imageTier, which cron interprets as permission to spend image credits.
- Save hands off only explicitly requested image work, capped to the requested remainder rather than every blank card.
- Queue route validates and respects maxImages alongside available credit balance and pack ownership.
- Navigation warning cleanup disarms itself without calling history.back(), which could race with Save-to-Home.
- Save reads the live card ref rather than the pre-await render closure.
- Pack and study image access survive cancellation; public cancellation copy updated; remaining legacy footer wordmark removed.
- End-to-end Save-to-Home still needs live verification after deployment; do not claim that the old browser failure was an automation issue.

## Launch blockers to resolve next

1. **Durable explicit image jobs:** generation page still runs a client loop, while the queue worker can also process cards. Move confirmed requests into one durable server queue with explicit selected card IDs and tiers, cancellation, budget reservation and idempotency. Closing the app must not lose remaining work. Never restore automatic imageTier assignment during text autosave. The queue concurrency fixes below address repeat submission and lease ownership, but do not provide provider-level exactly-once generation or atomic credit reservations.
2. **Study persistence:** study-session fire-and-forget review POST swallows errors. Implement an account-scoped durable pending-review queue plus server idempotency. Card schedule update and review log currently use Promise.all, not a transaction. Test lost responses, replay, offline/online, switching accounts, quitting and resuming; do not simulate learning on real user cards.
3. **Credit correctness:** image debits, image refunds and support grants now share a transaction with their ledger entries (evening follow-up below). Stripe purchase/refund ledger writes still need migration. Reconcile historical gaps; test concurrent spending, failures/refunds, interrupted jobs, cancellation and duplicate Stripe deliveries. Never infer a historical spend breakdown without evidence.
4. **Audio/session behaviour:** measure flip-to-audio latency on cached and uncached clips, idle/resume and mobile Safari/Capacitor; test gesture unlock and cleanup races. Prior automation limitations are not proof of root cause. Verify edits/deletes preserve session counts, random sessions traverse unique cards before repeats and settings persist.
5. **Billing migration:** await product decisions above, implement separate new plan without allowance while preserving legacy plans. Validate Stripe prices/currencies and displayed totals, checkout, cancellation, webhook replay, refund policies and account status in test mode. Do not charge real payment methods for smoke tests.
6. **Authentication and security:** verify fresh signup/onboarding, password reset, disabled provider buttons, ownership on all mutations, database RLS/roles and storage access using actual configuration. Re-check exposed credentials through authorized dashboards without printing secrets.
7. **Public launch page:** audit unsupported 6x learning claims and image-price labels; replace claims lacking product evidence. Update all pricing/cancellation/help text consistently once new billing is implemented.
8. **Native iOS:** scaffold exists but no verified simulator/device build. Verify Apple Developer membership, signing, native OAuth/deep links, safe areas, network failure, audio and current App Store payment requirements. A browser checkout is not a universal exemption from App Store rules. No submission without user authorization.

## Follow-up: queue concurrency (27 September, afternoon)

- Verified the previous changes are live: public HTML contains build f6071e0.
- Queue trigger now uses conditional writes and counts successful assignments. Requests cannot reset a running/queued card's lock, attempts or tier; stale cancelled leases can be requeued after the existing five-minute recovery threshold.
- Stop clears pending intent without clearing an active lease. A claimed image may finish; unclaimed candidates recheck tier and updatedAt before spending.
- Result/failure updates are fenced by the worker's claim timestamp; superseded results are refunded without overwriting a newer result or clearing a newer lease. Refund cleanup errors do not trigger a second refund in the same run.
- Inline work is scoped to the requesting account, and its deadline timer is cleared after completion.
- Mocked-provider route/worker tests cover cancellation before claim, overlapping claims, stale completion, stop, queue caps, caller ownership and refund cleanup failure. These are orchestration tests with mocked database responses, not real Postgres concurrency tests.
- Validation: 419 tests pass; targeted lint has no errors; production build and TypeScript pass. The rebrand test initially rejected historical wording in this checklist; that documentation was corrected before committing.
- Remaining: full image-job durability/client migration, database integration race tests, atomic debits/ledger/refunds, and live end-to-end image/Save smoke verification. No paid provider requests made in this follow-up.

## Follow-up: atomic image credit history (27 September, evening)

- Confirmed queue-concurrency build 923c6f9 is live.
- Image debits across subscription, purchased and starter credits now write their ledger entry inside the same Prisma transaction. Ledger failures propagate and abort the transaction; paid generation does not proceed on a failed debit.
- Image refunds and support credit grants also commit balance/history together and reject non-positive, fractional or non-finite amounts.
- No schema change, plan change, production balance adjustment or paid generation is part of this change.
- Validation: 435 tests, TypeScript, targeted lint and production build pass. Added transaction-boundary/failure-propagation tests against the real functions with mocked Prisma; no local Postgres/Docker runtime was available, so real database rollback/concurrency integration testing is still outstanding.
- Still open: operation IDs for replay-safe debit/refund, interrupted generation reconciliation, cross-period refund handling, Stripe purchase/refund atomic history and full job-level credit reservations. This change is not exactly-once billing.

## Working agreement

Continue in this task on the recurring launch-readiness schedule. Preserve user data and unrelated work. Use small reviewable changes, behavioural tests and deployment verification. Report concrete blockers and meaningful milestones, not repeated unchanged status. Marketing may be drafted; public posting has not been authorized. Pause the schedule when readiness work is complete.
