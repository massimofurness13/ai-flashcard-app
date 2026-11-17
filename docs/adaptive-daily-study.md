# Adaptive Daily 120

New daily sets start at 70 learning and 50 retention cards. Learning slots first
carry forward unfinished practice, prioritise recent lapses, then introduce the
oldest unstudied cards. Increasing learning capacity does not force that many
brand-new words into the session.

After three fresh completed sets, adjust the next set by five cards:

- At least 90% of selected retention cards rated Secure: five more learning slots.
- Below 80% Secure: five more retention slots.
- Between 80% and 90%: keep the split.

Retention stays between 40 and 80 slots, leaving 80 to 40 learning slots. These
are initial product thresholds to evaluate, not a proven optimum. Each decision
consumes its evidence window, so three further completed sets are needed before
another assessment. At least 20 retention grades per set are required. Look
back at most 14 calendar days; an absence does not count as failed recall.

Use only the first graded attempt on each selected face, from the plan's creation
until the following plan's creation (or now). Ignore passive views, repeats,
wrong faces, incomplete sets, and plans from before this policy. Deleted and
archived cards leave the required set. Queries are scoped to the authenticated
owner. The existing per-card spaced-repetition scheduler is unchanged.

Persist the allocation and last assessed day as optional `dailyAllocation`
metadata on the first pick in DailyStudyPlan's existing JSON array. Always read
this from raw stored picks, even if that card has since been deleted. This avoids
a database migration and keeps older clients compatible. A read-only completion
verifier can continue reading each pick's id and studyDirection unchanged.

The plan is created once by the existing atomic upsert. Refreshing, resuming,
finishing on another device, or a deployment cannot change that day's picks.
An existing completed 100-card set remains complete. Pool shortages produce a
shorter unique-card session rather than duplicates or invented Secure cards.

Tests cover recall thresholds, weighting, fresh evidence, bounds, direction and
time windows, deletions, cohort ordering, owner-scoped API integration, concurrent
creation and preserving completed older sets.
