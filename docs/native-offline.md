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
