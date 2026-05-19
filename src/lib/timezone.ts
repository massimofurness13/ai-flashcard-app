/**
 * Timezone-aware date helpers for streak and stats calculations.
 *
 * Background: the old code used `date.toISOString().split("T")[0]`
 * which buckets reviews by UTC date, not the user's local date.
 * For users east of UTC, a review at 9am local could end up
 * attributed to UTC yesterday, silently breaking streaks across
 * day boundaries.
 *
 * Read the user's `reminderTimezone` from the User table; fall back
 * to "UTC" if null. Pass it to these helpers everywhere bucketing
 * happens.
 */

/**
 * Format a Date as YYYY-MM-DD in the given IANA timezone.
 * Uses en-CA because that locale already formats as YYYY-MM-DD,
 * which is what we want for sortable date keys.
 */
export function toLocalDateKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Return the UTC timestamp that corresponds to 00:00:00 today in
 * the given timezone. Used for "reviews since start of today"
 * queries and date-arithmetic anchors. Handles DST correctly
 * because Intl.DateTimeFormat reflects the actual offset for the
 * date being formatted.
 */
export function startOfTodayInTz(tz: string): Date {
  const todayKey = toLocalDateKey(new Date(), tz);
  // Parse "YYYY-MM-DD" as midnight in tz by appending a tz-aware
  // time string. Using Intl to extract the offset is finicky —
  // easier to construct via a known-format input and a quick
  // correction.
  const naive = new Date(`${todayKey}T00:00:00Z`);
  // `naive` is "today midnight UTC." We want "today midnight in tz."
  // Format naive in tz to see how off we are.
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naive);
  const hour = parseInt(
    offsetParts.find((p) => p.type === "hour")?.value || "0",
    10,
  );
  const minute = parseInt(
    offsetParts.find((p) => p.type === "minute")?.value || "0",
    10,
  );
  const offsetMs = hour * 3_600_000 + minute * 60_000;
  return new Date(naive.getTime() - offsetMs);
}
