// comeback.js — the return protocol, and the habit slot ceiling.
//
// Two mechanics that only make sense together.
//
// The first is for the failure mode that actually ends attempts: two days off,
// then the routine is gone and the app is a monument to it. Marlatt called the
// deciding factor the abstinence violation effect — a lapse becomes a collapse
// when it is read as evidence about the person rather than about the week. So
// the return flow does three things the research supports: it refuses the
// characterological reading, it collects a coping plan for next time, and it
// makes the first days back genuinely smaller instead of asking for the same
// effort that just failed.
//
// The second is the ceiling on how many habits can run at once. Automaticity
// takes about two months per habit and simultaneous goals compete, so the app
// starts you with three and opens more slowly — and only while the ones you
// already have are holding. That is what stops a new habit from quietly
// replacing an old one instead of joining it.

import { getState, mutate } from './store.js';
import { todayKey, addDays, daysBetween, dayKey } from './dates.js';
import { isDue, statusOf, completionRate, ageInDays } from './habits.js';
import { STATUS } from './schema.js';
import { playerLevel } from './game.js';

/* ------------------------------------------------------------ being away */

/** The most recent day with anything logged, or null on a brand-new install. */
export function lastActiveDay(state = getState()) {
  const keys = Object.keys(state.logs)
    .filter((k) => Object.values(state.logs[k] || {}).some(
      (e) => e.status === STATUS.DONE || e.status === STATUS.PARTIAL))
    .sort();
  return keys.length ? keys[keys.length - 1] : null;
}

/** Whole days since anything was logged. 0 if today already has something. */
export function daysAway(state = getState(), key = todayKey()) {
  const last = lastActiveDay(state);
  if (!last) return 0;
  return Math.max(0, daysBetween(last, key));
}

/**
 * Whole days that went by with nothing logged, not counting today.
 *
 * This is the number that matters, and it is not the same as daysAway: a last
 * log two days back means exactly one day was missed, because today has not
 * finished yet. Getting these two confused is how a tool ends up telling
 * someone they lapsed twice when they missed once.
 */
export function daysMissed(state = getState(), key = todayKey()) {
  return Math.max(0, daysAway(state, key) - 1);
}

/**
 * Should the return screen open?
 *
 * Two full days missed. One is not a lapse — Lally's curve barely moves for it,
 * and treating it as one would manufacture the very failure reading this flow
 * exists to prevent. There has to be a history to return to, and it does not
 * fire twice for the same absence.
 */
export const RETURN_AFTER_MISSED = 2;

export function comebackDue(state = getState(), key = todayKey()) {
  if (!state.habits.some((x) => !x.archived)) return false;
  if (daysMissed(state, key) < RETURN_AFTER_MISSED) return false;
  const last = state.comebacks[state.comebacks.length - 1];
  return !last || last.day !== key;
}

/** Consecutive due days a habit has been missed, looking back from yesterday. */
export function missedRun(habit, state = getState(), key = todayKey()) {
  let run = 0;
  let cur = addDays(key, -1);
  let guard = 0;
  while (guard++ < 60) {
    if (!isDue(habit, cur)) { cur = addDays(cur, -1); continue; }
    const st = statusOf(state, cur, habit.id);
    if (st === STATUS.DONE || st === STATUS.PARTIAL || st === STATUS.SKIP) break;
    run += 1;
    cur = addDays(cur, -1);
  }
  return run;
}

/** Habits that have been missed at least twice running and are old enough to judge. */
export function lapsedHabits(state = getState(), key = todayKey()) {
  return state.habits
    .filter((x) => !x.archived && ageInDays(x, state) >= 3)
    .map((habit) => ({ habit, missed: missedRun(habit, state, key) }))
    .filter((r) => r.missed >= 2)
    .sort((a, b) => b.missed - a.missed);
}

/* ------------------------------------------------------------- easy mode */

export const EASY_DAYS = 3;

/** True while this habit's target is temporarily its two-minute version. */
export function isEasy(habit, key = todayKey()) {
  return !!habit.easyUntil && habit.easyUntil >= key;
}

/** What the habit is actually asking for today. */
export function targetOf(habit, key = todayKey()) {
  return isEasy(habit, key) && habit.tiny ? habit.tiny : habit.full || habit.title;
}

/**
 * Put habits into easy mode for a few days.
 *
 * Deliberately temporary and deliberately opt-in. A habit that silently
 * redefined itself would be worse than useless — you would stop trusting what
 * the row says. Three days is long enough to get a repetition in and short
 * enough that it does not become the new normal by accident.
 */
export function startEasyMode(habitIds, days = EASY_DAYS, key = todayKey()) {
  const until = addDays(key, days - 1);
  mutate((s) => {
    for (const hab of s.habits) {
      if (habitIds.includes(hab.id) && hab.tiny) hab.easyUntil = until;
    }
  });
  return until;
}

/** Record the return itself: what got in the way, and the plan for next time. */
export function logComeback({ away, cause = '', plan = '', eased = [] }, key = todayKey()) {
  mutate((s) => {
    s.comebacks.push({ day: key, at: Date.now(), away, cause, plan, eased });
    // The plan is only useful where it will be read again, so it also lands in
    // the Shield's if-then list when that section is switched on.
    if (plan && s.recovery.enabled) {
      s.recovery.plans.push({ id: `p_cb_${Date.now()}`, trigger: cause || 'I fall off for a couple of days',
        thenDo: plan, usedCount: 0 });
    }
  });
}

/** The causes offered on the return screen. Situational by design — none of
 *  them is a verdict about the person, which is the entire point. */
export const CAUSES = [
  { id: 'busy',    label: 'Too much on' },
  { id: 'travel',  label: 'Away from home' },
  { id: 'sleep',   label: 'Sleep went' },
  { id: 'low',     label: 'Felt low' },
  { id: 'ill',     label: 'Unwell' },
  { id: 'forgot',  label: 'Just forgot' },
];

/* ---------------------------------------------------------------- slots */

/* Slots open on the same thresholds as the ranks, so the two progressions
   agree instead of running on separate numbers. Three to start, matching the
   advice the app gives everywhere else. */
export const SLOT_LEVELS = [5, 10, 16, 24, 34, 46];
export const BASE_SLOTS = 3;
export const MAX_SLOTS = BASE_SLOTS + SLOT_LEVELS.length;

/** How many habits this level is allowed to run at once. */
export function slotsAtLevel(level) {
  return BASE_SLOTS + SLOT_LEVELS.filter((l) => level >= l).length;
}

/** The level at which the next slot opens, or null once they are all open. */
export function nextSlotLevel(level) {
  return SLOT_LEVELS.find((l) => level < l) || null;
}

/**
 * Whether the habits already running are healthy enough to take on another.
 *
 * This is the part that stops a new habit quietly replacing an old one. A slot
 * you have earned by levelling still does not open while something you already
 * committed to is falling over — the game should reward keeping, not collecting.
 * Habits younger than two weeks are exempt, because judging a habit before it
 * has had time to automate is just noise.
 */
export function habitsHolding(state = getState(), floor = 0.5) {
  const judged = state.habits
    .filter((x) => !x.archived && ageInDays(x, state) >= 14)
    .map((habit) => ({ habit, rate: completionRate(habit, state, 21) }));
  const weak = judged.filter((r) => r.rate < floor).sort((a, b) => a.rate - b.rate);
  return { ok: weak.length === 0, weak, judged };
}

/**
 * Everything the UI needs to explain the ceiling in one call.
 * `canAdd` is the only field that should ever gate a button.
 */
export function slotStatus(state = getState()) {
  const level = playerLevel(state).level;
  const total = slotsAtLevel(level);
  const used = state.habits.filter((x) => !x.archived).length;
  const holding = habitsHolding(state);
  const free = Math.max(0, total - used);

  let reason = null;
  if (free <= 0) reason = 'full';
  else if (!holding.ok) reason = 'holding';

  return {
    level, total, used, free,
    canAdd: free > 0 && holding.ok,
    reason,
    weakest: holding.weak[0] || null,
    nextAt: nextSlotLevel(level),
  };
}
