// dates.js — all day/time math lives here. Every other module asks this file
// what "today" means so the whole app agrees on a single definition of a day.

// A "day" does not end at midnight for a person who is awake at 1am.
// DAY_ROLLOVER_HOUR is the hour at which the app considers a new day to start.
// 4am is the default: anything logged at 1am still counts for the previous day.
export const DAY_ROLLOVER_HOUR = 4;

/** Returns a Date shifted so that hours before rollover belong to the previous day. */
function shifted(date = new Date()) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - DAY_ROLLOVER_HOUR);
  return d;
}

/** "2026-08-25" for a Date, in LOCAL time (never UTC — UTC shifts your day). */
export function dayKey(date = new Date()) {
  const d = shifted(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse "2026-08-25" back into a local Date at noon (noon avoids DST edges). */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Shift a day key by n days. addDays("2026-08-25", -1) -> "2026-08-24" */
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKeyFromLocalDate(d);
}

/** Format a Date that is already "the right day" (no rollover shift). */
export function dayKeyFromLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() { return dayKey(new Date()); }
export function yesterdayKey() { return addDays(todayKey(), -1); }

/** 0 = Sunday .. 6 = Saturday */
export function weekdayOf(key) { return keyToDate(key).getDay(); }

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Inclusive list of day keys from `from` to `to`. */
export function rangeKeys(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (guard++ < 4000) {
    out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}

/** The last n day keys ending today (oldest first). */
export function lastNDays(n, endKey = todayKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

/** Whole days between two keys (b - a). */
export function daysBetween(a, b) {
  return Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
}

/** Monday-start week key list containing `key`. */
export function weekOf(key) {
  const dow = weekdayOf(key);          // 0=Sun
  const offsetToMonday = (dow + 6) % 7; // Mon=0 ... Sun=6
  const monday = addDays(key, -offsetToMonday);
  return rangeKeys(monday, addDays(monday, 6));
}

/** "Mon 25 Aug" */
export function prettyDay(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Monday, 25 August" */
export function prettyDayLong(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function isToday(key) { return key === todayKey(); }

/** Minutes since local midnight, for right now. */
export function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

/** "05:12" -> 312 minutes. Returns null on bad input. */
export function parseHM(hm) {
  if (typeof hm !== 'string') return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 312 -> "05:12" (24h, for <input type=time>) */
export function toHM(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 312 -> "5:12 AM" (for display) */
export function prettyTime(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Human duration from milliseconds: "12d 4h", "4h 12m", "12m". */
export function humanDuration(ms) {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}
