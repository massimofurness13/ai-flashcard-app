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
  return startOfDateInTz(toLocalDateKey(new Date(), tz), tz);
}

/** Calendar arithmetic on a date key, independent of the server's timezone. */
export function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Resolve local midnight, including the date part and signed UTC offset. */
export function startOfDateInTz(key: string, tz: string): Date {
  const target = Date.parse(`${key}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let candidate = target;
  const seen = new Set<number>();
  // Re-evaluate the offset at the corrected instant: DST may differ from
  // the initial UTC-midnight estimate. Never interpret a negative offset
  // (e.g. 18:00 on the previous day) as a positive eighteen-hour offset.
  for (let attempt = 0; attempt < 4; attempt++) {
    seen.add(candidate);
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const correction = target - local;
    if (correction === 0) break;
    const corrected = candidate + correction;
    // Some zones jump forward at midnight, so 00:00 never occurs.
    // The two offsets oscillate around the gap; its later boundary is
    // the first valid instant of that local date (e.g. São Paulo 2018).
    if (seen.has(corrected)) return new Date(Math.max(candidate, corrected));
    candidate = corrected;
  }
  return new Date(candidate);
}
