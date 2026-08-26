// horizons.js — the long view.
//
// The rest of the app counts in days, because a day is the unit you can act on.
// A degree, a marriage and a life are not felt in days — they are felt in weeks,
// and a week is short enough to still be uncomfortable. Everything here converts
// a pair of dates into that unit and refuses to guess when it does not have both.
//
// Nothing in this file reads state or touches the DOM, so it stays testable.

import { todayKey, keyToDate, daysBetween } from './dates.js';

export const WEEK = 7;

/** True only for a real "YYYY-MM-DD" key — an empty date input gives "". */
export function isDayKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/**
 * Progress through a fixed span, counted in whole weeks.
 * Returns null unless both ends are real dates and the end is after the start,
 * so callers can treat "not set up" and "set up wrong" the same way.
 */
export function spanWeeks(startKey, endKey, nowKey = todayKey()) {
  if (!isDayKey(startKey) || !isDayKey(endKey)) return null;
  const totalDays = daysBetween(startKey, endKey);
  if (totalDays <= 0) return null;

  const elapsedDays   = Math.max(0, Math.min(totalDays, daysBetween(startKey, nowKey)));
  const remainingDays = totalDays - elapsedDays;
  const totalWeeks    = Math.max(1, Math.round(totalDays / WEEK));
  // Weeks done is deliberately floored: a week you are halfway through is not
  // done. The exception is a span that is over — totalWeeks is rounded, so a
  // floored count would leave it reading 199 of 200 forever.
  const weeksDone     = remainingDays <= 0
    ? totalWeeks
    : Math.min(totalWeeks, Math.floor(elapsedDays / WEEK));

  return {
    startKey, endKey,
    totalDays, elapsedDays, remainingDays,
    totalWeeks, weeksDone,
    weeksLeft: Math.max(0, totalWeeks - weeksDone),
    pct: elapsedDays / totalDays,
    phase: daysBetween(nowKey, startKey) > 0 ? 'before'
      : remainingDays <= 0 ? 'after' : 'during',
  };
}

/** Countdown to a single date. `days` goes negative once it has passed. */
export function countdown(targetKey, nowKey = todayKey()) {
  if (!isDayKey(targetKey)) return null;
  const days = daysBetween(nowKey, targetKey);
  const abs = Math.abs(days);
  return {
    targetKey,
    days,
    absDays: abs,
    weeks: Math.floor(abs / WEEK),
    months: Math.floor(abs / 30.44),
    years: abs / 365.25,
    past: days < 0,
  };
}

/** Whole years old on `atKey`. Null unless both dates are real. */
export function ageOn(birthKey, atKey) {
  if (!isDayKey(birthKey) || !isDayKey(atKey)) return null;
  const b = keyToDate(birthKey);
  const a = keyToDate(atKey);
  let years = a.getFullYear() - b.getFullYear();
  const beforeBirthday = a.getMonth() < b.getMonth()
    || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

/** "84 weeks" / "1 week" — the unit is the point, so it is never dropped. */
export function weekLabel(n) {
  return `${Math.abs(n).toLocaleString()} ${Math.abs(n) === 1 ? 'week' : 'weeks'}`;
}
