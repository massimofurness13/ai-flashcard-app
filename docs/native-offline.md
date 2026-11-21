# Installed iOS client

Huella iOS build 4 bundles the interface built by `npm run ios:build:web`. `capacitor.config.ts` must not contain a remote `server.url`. `npm run ios:sync` builds and copies the interface into Xcode. The website remains the sync/API service.

- Account-partitioned SQLite records and media files live in Application Support/Huella. Credentials live in Keychain, separately from the library.
- All active and archived packs sync automatically while the app is open and connected. New audio/artwork needs one connected download. Existing files and the UI are available without the server.
- Reviews, undo and session checkpoints commit atomically before advancing. Edits use a durable outbox and stable IDs. Server receipts prevent duplicate application after a lost acknowledgement. Conflicts retain the local edit and show an error rather than overwriting someone else's correction.
- Creates sync before plans/reviews; destructive mutations wait for pending reviews. Library data refresh never advances the statistics baseline while reviews remain pending.
- An upgrade imports old WebKit IndexedDB/local settings once through `/native-upgrade.html`. The old store remains intact. A stalled migration can retry. The migration requires one connection on upgrades from the remote wrapper; subsequent launches use bundled files.
- AI generation, purchases, sign-in and previously undownloaded content require a connection. iOS can suspend work when an app is closed; sync resumes on opening/foregrounding. This client does not yet contain the separate DELE classroom or its writing-marking queue.

## Database deployment

`20261119090000_native_mutation_receipts/migration.sql` adds DeviceMutation with RLS enabled and no client policies. The existing production database has no `_prisma_migrations` table; this exact additive SQL was applied through the authenticated Supabase SQL editor on 19 November 2026 and verified with `relrowsecurity=true`. Do not blindly run the historical migration directory against that database.

## Isolated validation

Use the dedicated **Huella Offline QA** simulator, never the learner's device/data. `scripts/native-tests/make-fixture.mjs` writes a synthetic fixture. A Debug-only `HUELLA_OFFLINE_FIXTURE` launch environment seeds that account; Release builds do not contain the hook. `--migration` exercises the old-origin export/import instead of seeding SQLite directly.

`exercise.js` disables fetch and reports proof into `qa:result` and `qa:restart` in the fixture database: launch, actual local WAV playback and PNG decoding, card editing, rating/checkpoint, navigation, and survival across full termination/relaunch. NativeDatabase's standalone Swift test covers rollback and account isolation. Vitest covers authentication, mutation receipts, conflicts, queue ordering, local results and scheduling.

## Build 6 responsiveness

Home keeps the daily action, streak, library and sorting; routine sync status is on Account → Downloads and Archived packs sits beneath the library. Bulk library sync pauses during a study session. Reviews still use the durable outbox, and session loading never waits for the outbox to drain. Native offline navigation remains within the bundled app.

Media availability uses batched file metadata checks, with account isolation and missing-file detection, instead of reading/base64-encoding every saved file. Native request and token-refresh waits honour the caller’s abort deadline (the underlying iOS request may finish separately). Goal celebration dismissal is immediate even when its acknowledgement is slow.

`make-responsiveness-fixture.mjs` plus `responsiveness.js` exercise a synthetic 1,466-card library, 1,500 historical journal entries, repeated native checks of 200 saved files, navigation, the daily120/50retention allocation and a never-resolving goal acknowledgement. Use the separate `app.huella.responsivenessqa` simulator bundle; never seed a real account. Timings include the normal three-second countdown.

## TestFlight distribution

Use the **Huella Automatic Updates** internal group for subsequent Xcode uploads. It was created with automatic distribution enabled on 20 November 2026 because Apple does not allow changing that option on an existing group. The original Huella Internal Testing group remains for continuity. Automatic distribution happens after Apple processes an eligible upload; it does not build/upload source commits or install updates on a tester's phone. Xcode Cloud builds require a separate distribution action.

`ios/App/App/Info.plist` declares `ITSAppUsesNonExemptEncryption=false`, matching the current internal beta's export-compliance answers. This means exempt encryption, not an absence of encryption: HTTPS/Keychain and platform cryptography protect connections and credentials, SHA-256 identifies media, and bundled PDF.js includes standard document decryption. The build 6 questionnaire was answered as standard algorithms, with no distribution in France for this private beta. Reassess the declaration before adding encryption features or expanding distribution, especially to France; do not copy this answer blindly into a public launch.

Before upload, inspect the **archived app's** Info.plist, not only the source: the declaration must be present as a Boolean false. After upload, confirm processing completes and the build appears as **Testing** in the automatic group with the intended tester. An upload-success message alone is not evidence of availability. Apple agreements, processing failures or changed compliance requirements can still block a release.

References: [automatic internal distribution](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/) and [Apple encryption declaration](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).

## Build 7 startup migration

The first upgrade imports essential records (cards, reviews, edits, plans and settings) before opening the UI. Saved media copies continue in the background; originals stay in WebKit and existing native records are never overwritten on retries. A separate durable library-ready marker lets subsequent launches open even if media copying was interrupted. Complete migrations still use the original marker. Native existence checks use metadata rather than decoding existing files.

Initial startup has a 40-second native deadline including website-data enumeration and cookie transfer, plus a 45-second JS fallback for a stalled bridge. Failed navigation, WebKit termination and idle exports resolve to a retry screen. Progress replaces the previous bare text page. Only this first legacy-origin upgrade needs a connection; normal bundled launches use saved data.

`make-startup-fixture.mjs` verifies essential records and restored identity, usable navigation before intentionally slow media transfers, eventual media completion and restart. Use only the isolated `app.huella.startupqa` simulator bundle.

## Build 8 saved-session repair

Missing Keychain entries resolve to an empty object; the JS auth adapter also tolerates older undefined replies and returns null for optional keys. A missing primary session can retry the old app cookie once per client lifetime, only for the matching saved account and never behind an explicit logout fence. Credentials remain in Keychain; recovery does not overwrite a newer session, and credential writes/removals invalidate in-flight recovery.

Reconnection is only requested after a successful session check confirms no session, and the native prompt is confined to Account. Statistics remain readable from the saved account. Query refreshes restart when the session becomes available, and unexpected technical errors are replaced with a short saved-data message. `make-auth-fixture.mjs` tests the real bridge and Keychain in the signed, isolated `app.huella.authqa` simulator using synthetic cookies only.

### Build 9 — owned audio playback and retry (21 November 2026)

Each spoken phrase now owns its playback callbacks and cancellation. A late
lookup, old component cleanup, or delayed silent-unlock completion cannot stop
or replace the next phrase. Transient media errors receive one retry; a stalled
load has an eight-second deadline per attempt. Autoplay-policy failures expose
the existing speaker button as “Retry audio.” Failures and cancellations no
longer signal successful completion to the study timer. A successful manual
retry releases the timer normally. Playback speed, review results, and saved
media remain unchanged.

Validation: nine playback regression tests, including three races reproduced
against the old player, plus the existing full suite. An isolated signed iOS
simulator played all four recordings for the two reported cards from SQLite
media blobs with networking disabled. Both manual and one-second timed study
were exercised. A deliberately rejected play showed Retry audio without
advancing; retry played the English recording and normal advancement resumed.
The reusable simulator exercise is `scripts/native-tests/audio-playback.js`.
Only the synthetic fixture account was reviewed. These tests verify the repaired
failure paths; they do not establish which path occurred on the user's phone.

### Build 10 — production configuration and incomplete history

Archive inspection found builds 4–9 had bundled `placeholder.supabase.co` from
local web-development settings. This prevented native authentication, token
refresh and uploads while saved library pages still worked. Native builds now
read the ignored `.env.native.local` public configuration and validate the exact
production project, callback origin, and non-expired public anon-key claims.
Service-role keys and placeholders are rejected. Vite writes a manifest of
final JavaScript hashes; an Xcode build phase verifies the actual copied bundle
before compiling/signing. The public URL/key were recovered from the live site's
public JavaScript, and `/auth/v1/settings` confirmed the key and enabled Google
provider. No account credential or service-role key is bundled.

An isolated signed simulator clicked the actual bundled Google button and
verified its production authorization URL, PKCE challenge and callback before
stopping the interactive handoff. The real iOS HTTP bridge then reached the
production auth settings successfully. This checks the release configuration,
not merely a mock transport. It does not sign in as a learner or upload reviews.

Older cached pack documents lacking review arrays are unknown-history records,
not new vocabulary. A new daily/due/practice selection refreshes those records
when connected or asks for the one-time history refresh when offline. Existing
sets, pending ratings and edits remain intact. New local result snapshots carry
verified history; uncertain old local promotion summaries wait for server
reconciliation. Secure recall snapshots are included in the before/after count.

SDK credential-loss events no longer clear the saved local account selection or
interrupt study. Only explicit app sign-out (including after account deletion)
sets the sign-out fence and hides that account. Offline errors retain the account
without requesting login; valid session restoration resumes sync automatically.
If credentials really are absent/revoked, cloud access remains blocked and a
single normal sign-in is offered on Settings while local work remains available.
Regression tests cover offline/online SDK events, reopening, automatic recovery,
pending review preservation, stale refresh responses and cross-tab logout.

### Build 11 — statistics refresh and upload pressure

The live read-only audit on 21 November reached 120 distinct rated cards matching
all 120 picks; the gate verified completion at 14:25:37.354 UTC. The earlier 83
was a partial upload (exactly the first 83 picks), not missing study evidence or
a changed daily target. No learner record or completion flag was edited.

A local route reproduction using 5,464 actual review timestamps/qualities reached
593 MB process RSS and 761 ms. Reusing bounded Intl date formatters and reading
history once instead of four overlapping queries returned the same totals at
84 MB and 92 ms in a fresh process. These are local measurements, not claimed
Render production telemetry. Regression coverage uses synthetic 6,000-review
history and verifies one history read and bounded formatter allocation.

Query deadlines now cover storage, authentication and projection as well as
fetch. Offline missing-cache screens provide an explicit state and retry. A
period change keeps the previous chart (and its correct period label) visible
until the new data arrives; controls remain available even without initial data.
Review uploads invalidate remote pages once per batch, while local progress
continues updating per acknowledgement. Pending status is simply “Syncing · N
pending” or “Offline · N pending”. No ratings, account IDs or queued work change.
