/**
 * Timezone-aware date/hour helpers for Setlog. Server code (Vercel
 * functions) runs in UTC regardless of where it's deployed, so "today" and
 * "this hour" only mean the right thing here if we explicitly convert
 * through America/New_York rather than trusting the runtime's local clock.
 * Pure JS/Intl only -- safe to import from client code too.
 */

export const SETLOG_TIMEZONE = "America/New_York";
/** Active window is 6am-11pm ET inclusive -- an hourly prompt fires at the top of each of these hours, no notifications overnight. */
export const SETLOG_FIRST_HOUR = 6;
export const SETLOG_LAST_HOUR = 23;

/** "2026-07-24" for the given instant, as read in SETLOG_TIMEZONE. */
export function etDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SETLOG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The ET wall-clock hour (0-23) for the given instant. */
export function etHour(date: Date): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: SETLOG_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // "24" shows up for midnight in some locale/engine combinations -- normalize to 0.
  const h = Number(hourStr);
  return h === 24 ? 0 : h;
}

export function isWithinActiveHours(hour: number): boolean {
  return hour >= SETLOG_FIRST_HOUR && hour <= SETLOG_LAST_HOUR;
}

export function setlogSlotId(date: string, hour: number): string {
  return `${date}_h${String(hour).padStart(2, "0")}`;
}

/** 13 -> "1pm", 0 -> "12am", 12 -> "12pm" -- used for both the slot arrow label and posting notifications. */
export function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
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

/** End of the ET calendar day containing `date` (i.e. midnight ET the next day), as a UTC instant -- used for a clip's editableUntil. */
export function etEndOfDayUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Pure calendar-date arithmetic (UTC-based Date math just to roll the day
  // forward, correctly overflowing month/year) -- NOT an instant, so there's
  // no timezone to get wrong yet. Only the final etWallTimeToUtc call below
  // actually resolves a real-world instant.
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDateStr = [
    nextDay.getUTCFullYear(),
    String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDay.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return etWallTimeToUtc(nextDateStr, 0, 0);
}

/** The instant a given ET slot's hour ends (exactly 60 real minutes after it starts). */
export function etSlotEndsAtUtc(date: string, hour: number): Date {
  return new Date(etWallTimeToUtc(date, hour, 0).getTime() + 60 * 60 * 1000);
}
