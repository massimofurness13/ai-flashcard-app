# Huella launch readiness

Last checked: 27 September 2026. This is an evidence log, not a declaration that the app is ready.

## Product decisions pending

- User proposes £3.99/month, later describes $4.99/month, with images bought separately as one-time credit purchases. Asked whether to offer GBP, USD or both; no answer yet.
- Current free tier already offers essentially all study features. Asked which features the new subscription unlocks. Do not silently put previously free features behind a paywall.
- Existing subscribers must retain the allowances they bought (500/month or 6,000/year). New pricing needs distinct Stripe prices and a distinct entitlement policy. Merely changing price labels would be wrong.
- Generated images remain accessible after cancellation. Current branch implements this for all retained illustrations, including starter-credit images. Pack ownership checks remain required.

## Verified baseline

- Production URL https://flashmind-35q4.onrender.com served build 3738969 at audit start.
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
- Pack and study image access survive cancellation; public cancellation copy updated; remaining FlashMind footer wordmark removed.
- End-to-end Save-to-Home still needs live verification after deployment; do not claim that the old browser failure was an automation issue.

## Launch blockers to resolve next

1. **Durable explicit image jobs:** generation page still runs a client loop, while the queue worker can also process cards. Move confirmed requests into one durable server queue with explicit selected card IDs and tiers, cancellation, budget reservation and idempotency. Closing the app must not lose remaining work. Never restore automatic imageTier assignment during text autosave. Queue endpoint currently resets locks and attempts on repeat submission; audit duplicate charging under concurrent retries.
2. **Study persistence:** study-session fire-and-forget review POST swallows errors. Implement an account-scoped durable pending-review queue plus server idempotency. Card schedule update and review log currently use Promise.all, not a transaction. Test lost responses, replay, offline/online, switching accounts, quitting and resuming; do not simulate learning on real user cards.
3. **Credit correctness:** debit and ledger writes are separate/best-effort. Reconcile and make atomic; test concurrent spending, failures/refunds, interrupted jobs, cancellation and duplicate Stripe deliveries. Never infer a historical spend breakdown without evidence.
4. **Audio/session behaviour:** measure flip-to-audio latency on cached and uncached clips, idle/resume and mobile Safari/Capacitor; test gesture unlock and cleanup races. Prior automation limitations are not proof of root cause. Verify edits/deletes preserve session counts, random sessions traverse unique cards before repeats and settings persist.
5. **Billing migration:** await product decisions above, implement separate new plan without allowance while preserving legacy plans. Validate Stripe prices/currencies and displayed totals, checkout, cancellation, webhook replay, refund policies and account status in test mode. Do not charge real payment methods for smoke tests.
6. **Authentication and security:** verify fresh signup/onboarding, password reset, disabled provider buttons, ownership on all mutations, database RLS/roles and storage access using actual configuration. Re-check exposed credentials through authorized dashboards without printing secrets.
7. **Public launch page:** audit unsupported 6x learning claims and image-price labels; replace claims lacking product evidence. Update all pricing/cancellation/help text consistently once new billing is implemented.
8. **Native iOS:** scaffold exists but no verified simulator/device build. Verify Apple Developer membership, signing, native OAuth/deep links, safe areas, network failure, audio and current App Store payment requirements. A browser checkout is not a universal exemption from App Store rules. No submission without user authorization.

## Working agreement

Continue in this task on the recurring launch-readiness schedule. Preserve user data and unrelated work. Use small reviewable changes, behavioural tests and deployment verification. Report concrete blockers and meaningful milestones, not repeated unchanged status. Marketing may be drafted; public posting has not been authorized. Pause the schedule when readiness work is complete.
