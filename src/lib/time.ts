/**
 * Time-zone aware day arithmetic without a date library.
 * The yard operates in Europe/Zurich; every "day" boundary in the product is a Zurich day.
 */

export const YARD_TIME_ZONE = "Europe/Zurich";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date, timeZone: string = YARD_TIME_ZONE): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")) % 24,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: Math.max(0, WEEKDAYS.indexOf(read("weekday"))),
  };
}

/** Offset of the zone versus UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(date: Date, timeZone: string = YARD_TIME_ZONE): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Builds the instant corresponding to a wall-clock time in the zone. */
export function zonedDate(
  wall: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string = YARD_TIME_ZONE,
): Date {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  );
  // Two passes handle DST transitions correctly.
  let offset = zoneOffsetMinutes(new Date(guess), timeZone);
  let instant = guess - offset * 60_000;
  offset = zoneOffsetMinutes(new Date(instant), timeZone);
  instant = guess - offset * 60_000;
  return new Date(instant);
}

export function startOfDay(date: Date, timeZone: string = YARD_TIME_ZONE): Date {
  const parts = zonedParts(date, timeZone);
  return zonedDate({ year: parts.year, month: parts.month, day: parts.day }, timeZone);
}

export function addDays(date: Date, days: number, timeZone: string = YARD_TIME_ZONE): Date {
  const parts = zonedParts(date, timeZone);
  return zonedDate(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + days,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    },
    timeZone,
  );
}

/** "YYYY-MM-DD" key of the zoned day, handy for grouping. */
export function dayKey(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
