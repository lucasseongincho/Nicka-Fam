/**
 * Timezone-aware date/scheduling helpers for Setlog. Server code (Vercel
 * functions) runs in UTC regardless of where it's deployed, so "today" and
 * "9am" only mean the right thing here if we explicitly convert through
 * America/New_York rather than trusting the runtime's local clock.
 */

export const SETLOG_TIMEZONE = "America/New_York";
export const SETLOG_ACTIVE_HOURS_START = 9;
export const SETLOG_ACTIVE_HOURS_END = 22;
export const SETLOG_WINDOW_MINUTES = 8;
export const SETLOG_MIN_SLOTS = 3;
export const SETLOG_MAX_SLOTS = 5;
/** Minimum spacing enforced between two random slot times, so prompts don't cluster. */
const MIN_SLOT_GAP_MINUTES = 60;

/** "2026-07-24" for the given instant, as read in SETLOG_TIMEZONE. */
export function etDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SETLOG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Yesterday's ET calendar date string, relative to the given instant. */
export function etYesterdayDateString(date: Date): string {
  // Subtracting 24h in UTC and re-reading the ET calendar date is safe even
  // across a DST transition -- we only need "the previous ET calendar day",
  // not an exact 24h-earlier instant.
  return etDateString(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

/**
 * Converts a wall-clock time on a given ET calendar date to the UTC instant
 * it actually represents (correct across DST). Standard "double conversion"
 * trick: treat (dateStr, hour, minute) as if it were UTC, see how that
 * guess reads back when formatted in SETLOG_TIMEZONE, then correct by the
 * difference.
 */
export function etWallTimeToUtc(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guess = new Date(naiveUtcMs);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SETLOG_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(guess)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const readBackMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = readBackMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs);
}

/**
 * Picks 3-5 random capture times for a day, spaced at least
 * MIN_SLOT_GAP_MINUTES apart within the active-hours window, and returns
 * them as UTC instants sorted ascending. Falls back to an evenly-spaced
 * (still slightly jittered) layout if rejection sampling can't find a
 * spaced-out set quickly -- keeps this deterministic-ish rather than ever
 * looping unboundedly.
 */
export function generateSetlogSlotTimes(dateStr: string): Date[] {
  const count = SETLOG_MIN_SLOTS + Math.floor(Math.random() * (SETLOG_MAX_SLOTS - SETLOG_MIN_SLOTS + 1));
  const startMinute = SETLOG_ACTIVE_HOURS_START * 60;
  const endMinute = SETLOG_ACTIVE_HOURS_END * 60;

  let minutes: number[] | null = null;
  for (let attempt = 0; attempt < 200 && !minutes; attempt++) {
    const candidate = Array.from(
      { length: count },
      () => startMinute + Math.random() * (endMinute - startMinute),
    ).sort((a, b) => a - b);

    const spaced = candidate.every(
      (m, i) => i === 0 || m - candidate[i - 1] >= MIN_SLOT_GAP_MINUTES,
    );
    if (spaced) minutes = candidate;
  }

  if (!minutes) {
    const span = (endMinute - startMinute) / count;
    minutes = Array.from({ length: count }, (_, i) => startMinute + span * (i + 0.5));
  }

  return minutes.map((m) => etWallTimeToUtc(dateStr, Math.floor(m / 60), Math.round(m % 60)));
}
