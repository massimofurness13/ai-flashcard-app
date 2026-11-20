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
