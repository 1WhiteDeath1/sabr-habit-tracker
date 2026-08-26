// stats.js — the numbers behind the Records and Clock screens.
//
// Two rules shaped everything here.
//
// First: a record is not a streak. A streak is anxiety — it exists to be lost,
// and on the day you most need to open the app it is the thing telling you that
// you failed. Every number on the Records screen is a ceiling instead. None of
// them can go down, whatever kind of week you have had, which is what makes it
// the page that is safe to open after a bad one.
//
// Second: every completion has already been stamped with `at` and `tier` since
// the first version of this app, and nothing has ever read them. The Clock is
// built entirely out of that dead data — no new tracking, just arithmetic on
// what was there the whole time.

import { getState } from './store.js';
import { STATUS } from './schema.js';
import { todayKey, weekOf, daysBetween, DAY_ROLLOVER_HOUR } from './dates.js';
import { bestStreakOf, isDue, ageInDays } from './habits.js';

const COMPLETED = new Set([STATUS.DONE, STATUS.PARTIAL]);

/** Every [dayKey, habitId, entry] that counts as done. One pass, reused a lot. */
function completions(state) {
  const out = [];
  for (const day of Object.keys(state.logs)) {
    for (const [habitId, entry] of Object.entries(state.logs[day] || {})) {
      if (COMPLETED.has(entry.status)) out.push({ day, habitId, entry });
    }
  }
  return out;
}

/** Highest value in a map, with the key that produced it. */
function peak(counts) {
  let best = { key: null, n: 0 };
  for (const [key, n] of Object.entries(counts)) if (n > best.n) best = { key, n };
  return best;
}

/* --------------------------------------------------------------- records */

/**
 * A day is perfect when every habit that was due on it got done. Days with
 * nothing due do not count as perfect — an empty day is not an achievement.
 */
function perfectDays(state) {
  const days = Object.keys(state.logs).sort();
  const out = [];
  for (const day of days) {
    const due = state.habits.filter((hab) => isDue(hab, day));
    if (!due.length) continue;
    const all = due.every((hab) => COMPLETED.has(state.logs[day]?.[hab.id]?.status));
    if (all) out.push(day);
  }
  return out;
}

/** Longest run of consecutive calendar days inside a sorted list of day keys. */
function longestRun(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

export function records(state = getState()) {
  const done = completions(state);
  const live = state.habits.filter((x) => !x.archived);

  const perDay = {};
  const perWeek = {};
  const perMonth = {};
  let fullCount = 0;
  for (const c of done) {
    perDay[c.day] = (perDay[c.day] || 0) + 1;
    const monday = weekOf(c.day)[0];
    perWeek[monday] = (perWeek[monday] || 0) + 1;
    const month = c.day.slice(0, 7);
    perMonth[month] = (perMonth[month] || 0) + 1;
    if (c.entry.tier !== 'tiny') fullCount += 1;
  }

  const perfect = perfectDays(state);
  const streaks = state.habits
    .map((habit) => ({ habit, best: bestStreakOf(habit, state) }))
    .sort((a, b) => b.best - a.best);

  return {
    total: done.length,
    daysLogged: Object.keys(state.logs).length,
    bestDay: peak(perDay),
    bestWeek: peak(perWeek),
    bestMonth: peak(perMonth),
    perfectDays: perfect.length,
    bestPerfectRun: longestRun(perfect),
    bestStreak: streaks[0] && streaks[0].best > 0 ? streaks[0] : null,
    fullShare: done.length ? fullCount / done.length : 0,
    cleanBest: state.recovery.enabled ? state.recovery.bestStreakDays : null,
    cleanLifetime: state.recovery.enabled ? state.recovery.lifetimeCleanDays : null,
    // Habits past the 66-day marker, which is the closest thing to graduation
    // this app has and, like every other number here, cannot fall.
    automatic: live.filter((hab) => ageInDays(hab, state) >= 66).length,
    liveCount: live.length,
  };
}

/* ------------------------------------------------------------- comebacks */

/**
 * The same data the return screen collects, read the other way round.
 *
 * The count of times you fell off is identical to the count of times you came
 * back — that is not a trick of framing, it is arithmetic, and it is true of
 * anyone who is here to read it.
 */
export function comebacks(state = getState()) {
  const list = state.comebacks || [];
  if (!list.length) return null;

  const causes = {};
  for (const c of list) if (c.cause) causes[c.cause] = (causes[c.cause] || 0) + 1;
  const top = peak(causes);
  const longest = list.reduce((max, c) => Math.max(max, c.away || 0), 0);
  const last = list[list.length - 1];

  return {
    times: list.length,
    longestGap: longest,
    topCause: top.key ? { label: top.key, n: top.n } : null,
    lastDay: last.day,
    sinceLast: daysBetween(last.day, todayKey()),
    withPlan: list.filter((c) => c.plan).length,
  };
}

/* ----------------------------------------------------------------- clock */

const DAY_MINUTES = 24 * 60;

/** Minutes since midnight for a completion timestamp. */
function minuteOf(at) {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/** Middle value of a sorted numeric array. */
function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

/**
 * How tightly a habit clusters in time.
 *
 * The spread is the interquartile range rather than the full range, because one
 * 3am outlier should not be allowed to describe a habit you otherwise do at the
 * same time every morning. The thresholds are a reading aid, not a finding —
 * the useful claim underneath is only that a behaviour with a consistent time
 * has a cue and one without a consistent time does not yet.
 */
export function spreadVerdict(iqr) {
  if (iqr == null) return null;
  if (iqr <= 45) return { id: 'anchored', label: 'Anchored', tone: 'accent' };
  if (iqr <= 150) return { id: 'loose', label: 'Loose', tone: 'gold' };
  return { id: 'drifting', label: 'No fixed time', tone: 'orange' };
}

/**
 * Hour-by-hour data for the clock.
 *
 * The dial starts at the app's own day boundary rather than at midnight, so a
 * habit logged at 1am sits at the end of the day it belonged to instead of
 * jumping to the start of the next one.
 */
export function clock(state = getState(), { days = 90 } = {}) {
  const since = days ? daysBetween('1970-01-01', todayKey()) - days : null;
  const buckets = new Array(24).fill(0);
  const byHabit = {};

  for (const c of completions(state)) {
    if (since !== null && daysBetween('1970-01-01', c.day) < since) continue;
    if (!c.entry.at) continue;
    const minute = minuteOf(c.entry.at);
    buckets[Math.floor(minute / 60)] += 1;
    (byHabit[c.habitId] ||= []).push(minute);
  }

  const peakHour = buckets.indexOf(Math.max(...buckets));
  const habits = state.habits
    .filter((x) => !x.archived && (byHabit[x.id] || []).length >= 3)
    .map((habit) => {
      const mins = byHabit[habit.id].slice().sort((a, b) => a - b);
      const iqr = quantile(mins, 0.75) - quantile(mins, 0.25);
      return {
        habit,
        n: mins.length,
        median: median(mins),
        from: quantile(mins, 0.25),
        to: quantile(mins, 0.75),
        iqr,
        verdict: spreadVerdict(iqr),
      };
    })
    .sort((a, b) => a.iqr - b.iqr);

  const all = Object.values(byHabit).flat().sort((a, b) => a - b);

  return {
    buckets,
    total: buckets.reduce((n, x) => n + x, 0),
    max: Math.max(...buckets),
    peakHour: buckets[peakHour] ? peakHour : null,
    startHour: DAY_ROLLOVER_HOUR,
    earliest: all.length ? all[0] : null,
    latest: all.length ? all[all.length - 1] : null,
    habits,
    /** Ordered so the dial can be drawn from the app's day boundary. */
    dial: Array.from({ length: 24 }, (_, i) => {
      const hour = (DAY_ROLLOVER_HOUR + i) % 24;
      return { hour, n: buckets[hour] };
    }),
  };
}

export { DAY_MINUTES };
