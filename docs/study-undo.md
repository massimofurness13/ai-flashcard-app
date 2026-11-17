# Study rating undo

Undo returns to the most recently rated card in the current session with its
answer revealed. Repeated undo walks backwards. The completion screen can undo
the final card. Editing a card preserves undo history; deleting it removes its
history entries. A brand-new/reloaded session does not restore earlier undo
history unless it is resuming an edit snapshot.

Each review stores its previous and resulting card/directional schedules in
ReviewUndo in the same transaction as ReviewLog. Undo takes the same owner-scoped
card row lock, verifies the current schedules still match that event's results,
restores the prior schedules and removes the counted ReviewLog. Its ReviewUndo
tombstone remains, making retries harmless and preventing resurrection of the
original event. A newer conflicting review returns 409 instead of being lost.

The device outbox durably queues original rating, undo, and replacement in order.
Unacknowledged operations survive app restart. A rejected undo blocks subsequent
operations on that card and remains visible through the existing sync error UI.
Session counts and timed-card counts roll back; elapsed effort is preserved.

Apply prisma/migrations/2026-11-17-review-undo.sql before deploying the application.
It is additive and enables RLS with no client-access policy. No previous review
records are altered by deployment. Reviews created before this feature have no
undo snapshot and cannot be reversed by this endpoint.

Validation includes API ownership, snapshots, changed-device conflicts, JSONB
key ordering, retry idempotency, offline ordering, corrected counts, and an
isolated browser fixture using the real session and completion components.
