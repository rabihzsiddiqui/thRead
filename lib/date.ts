/**
 * Date shapes used across the three screens.
 *
 * The prototype hard-coded "tue 11 sep" / "Tuesday" / "11 September". A real
 * day derives them, so these take a Date and default to now.
 */

const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Storage key for a calendar day, in local time: "2026-09-12". */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Header date, lowercase. CSS uppercases it: "tue 11 sep". */
export function dateShort(d: Date = new Date()): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** The Day's title: "Tuesday". */
export function dayTitle(d: Date = new Date()): string {
  return WEEKDAY_LONG[d.getDay()];
}

/** Long date without the weekday: "11 September". */
export function dayLong(d: Date = new Date()): string {
  return `${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}

/**
 * The Day's subtitle: "11 September, written at dusk".
 * The tail names the hour the day was woven, not the hour it is read.
 */
export function daySub(d: Date = new Date(), wovenAt: Date = d): string {
  return `${dayLong(d)}, written ${partOfDay(wovenAt)}`;
}

function partOfDay(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "in the small hours";
  if (h < 12) return "in the morning";
  if (h < 17) return "in the afternoon";
  if (h < 21) return "at dusk";
  return "at night";
}

/** Fragment timestamp: "07:12". */
export function clock(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Elapsed recording time: "01:24". */
export function elapsed(seconds: number): string {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}
