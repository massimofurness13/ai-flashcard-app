# Huella launch readiness

Last checked: 6 October 2026. This is an evidence log, not a declaration that the app is ready.

## October launch test pass

- Automated suite: 565 passing tests, up from 514 at the start of this pass. TypeScript, targeted lint and the production web build pass. The iOS Simulator build also passes with Capacitor 8.5.2; this is not a new TestFlight distribution.
- Live browser on build f7da08f: signed-in library, study configuration and manual tap-to-flip work. A random 125-card request from a 98-card pack contains all 98 unique cards before repeating. Rating controls appear only after revealing the answer. Opening the card editor and canceling returns to the same card and 1/125 counter. Mid-session save/delete counts and actual audio timing still require verification.
- Fixed a confirmed lost-review path: unauthenticated APIs return JSON 401 instead of redirecting to an HTML login page; the durable outbox removes a review only after an explicit `recorded: true` acknowledgement. New regressions failed before the fix and pass afterward.
- Fixed checkout boundaries with mocked Stripe tests: malformed plans/bundles are rejected, existing live subscribers go to billing management instead of a second subscription checkout, and transient Stripe errors do not replace the stored customer identity. Live price IDs, portal plan-change configuration and end-to-end payments remain unverified in this pass. No prices or entitlements changed.
- Updated Next.js to 16.3.8, Capacitor to 8.5.2, PDF.js to 6.4.299 and the Anthropic SDK to 0.91.1; aligned Prisma packages at 7.10.0. Replaced PDF import's empty worker URL with a same-origin, version-matched worker generated during build. PDF extraction releases its worker after success or failure. A local Chrome check of the real extraction function successfully read the full text from a synthetic one-page PDF; no AI calls or file uploads were made.
- Production-dependency audit fell from 49 findings (3 critical) to 7 (0 critical, 4 high, 3 moderate). Remaining chains are Prisma's deepmerge-ts/mysql2 and Capacitor CLI's xcode/uuid. They are not cleared: assess reachability and compatible upstream fixes; do not force a Prisma 6 downgrade or an untested major transitive override merely to make the scan green. This app uses PostgreSQL, not MySQL.
- The latest successful scheduled image-worker run returned `no_work`. Recent GitHub runs were hours apart despite a five-minute schedule; verify the separate external cron service before promising prompt background completion. Fixed the workflow's false-success path: all failed HTTP calls now fail the job. Four tests exercise the actual Bash with a stubbed curl, covering empty queue, remaining work, failed requests and missing secrets.
- Added PR/main validation for clean install, generated Prisma client, tests, TypeScript and production build, using non-production fixtures and no production credentials.
- No real reviews, payments, image generations, credit adjustments, card changes or subscription changes were performed in these checks.

Security references: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), [Capacitor advisory](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv), [PDF.js advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j). The native fix requires rebuilding and redistributing the iOS app.

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
2. **Study persistence validation:** account-scoped durable reviews, server idempotency and a transactional schedule/review write are now implemented. The October pass adds explicit acknowledgement validation. Still test these against real Postgres under lost responses, concurrent replay, offline/online, account switching and native quit/resume; do not simulate learning on real user cards.
3. **Credit correctness:** image debits, image refunds and support grants now share a transaction with their ledger entries (evening follow-up below). Stripe purchase/refund ledger writes still need migration. Reconcile historical gaps; test concurrent spending, failures/refunds, interrupted jobs, cancellation and duplicate Stripe deliveries. Never infer a historical spend breakdown without evidence.
4. **Audio/session behaviour:** measure flip-to-audio latency on cached and uncached clips, idle/resume and mobile Safari/Capacitor; test gesture unlock and cleanup races. Prior automation limitations are not proof of root cause. Verify edits/deletes preserve session counts, random sessions traverse unique cards before repeats and settings persist.
5. **Billing migration:** await product decisions above, implement separate new plan without allowance while preserving legacy plans. Validate Stripe prices/currencies and displayed totals, checkout, cancellation, webhook replay, refund policies and account status in test mode. Do not charge real payment methods for smoke tests.
6. **Authentication and security:** verify fresh signup/onboarding, password reset, disabled provider buttons, ownership on all mutations, database RLS/roles and storage access using actual configuration. Re-check exposed credentials through authorized dashboards without printing secrets.
7. **Public launch page:** audit unsupported 6x learning claims and image-price labels; replace claims lacking product evidence. Update all pricing/cancellation/help text consistently once new billing is implemented.
8. **Native iOS:** a simulator build with patched Capacitor is verified. Rebuild/distribute through TestFlight and validate native OAuth/deep links, safe areas, network failure, idle/resume audio and current App Store payment requirements on the user's device. A browser checkout is not a universal exemption from App Store rules. The local-first data layer does not yet provide a fully offline cold-start app shell.

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
