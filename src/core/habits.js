// habits.js — the habit engine. Due-dates, streaks, logging, XP payout.
// Views never compute streaks themselves; they ask here. One definition, used
// everywhere, so the number on the Today screen and the number on the stats
// screen can never disagree.

import { getState, mutate } from './store.js';
import { STATUS, makeHabit, CATEGORY_ATTR, SLOTS } from './schema.js';
import { grantXp, comboMultiplier, playerLevel, XP } from './game.js';
import { syncSpent, payoutFor } from './economy.js';
import { todayKey, addDays, weekdayOf, weekOf, lastNDays, daysBetween, dayKey } from './dates.js';
import { prayerTimesFor } from './prayer.js';

/* ------------------------------------------------------------------- due */

/** Is this habit expected on this day? */
export function isDue(habit, key) {
  if (habit.archived) return false;
  const c = habit.cadence || { type: 'daily' };
  switch (c.type) {
    case 'daily':    return true;
    case 'weekdays': return Array.isArray(c.days) && c.days.includes(weekdayOf(key));
    case 'times':    return true;   // available every day; the target is weekly
    default:         return true;
  }
}

/** For 'times' cadence: how many are still owed this week. */
export function weeklyRemaining(habit, state = getState(), key = todayKey()) {
  if (habit.cadence?.type !== 'times') return null;
  const target = habit.cadence.perWeek || 3;
  const done = weekOf(key).filter((k) => statusOf(state, k, habit.id) === STATUS.DONE).length;
  return Math.max(0, target - done);
}

/* --------------------------------------------------------------- logging */

export function statusOf(state, key, habitId) {
  return state.logs?.[key]?.[habitId]?.status || null;
}

export function entryOf(state, key, habitId) {
  return state.logs?.[key]?.[habitId] || null;
}

/**
 * Set (or clear) a habit's status for a day. The only mutation path for habit
 * completion, so XP, streaks and quest progress stay in lockstep.
 * Passing the status that is already set clears it (tap again to undo).
 */
export function setStatus(habitId, key, status, { tier = 'full', note = '' } = {}) {
  const state = getState();
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return null;

  const existing = statusOf(state, key, habitId);
  const clearing = existing === status;

  mutate((s) => {
    if (!s.logs[key]) s.logs[key] = {};
    if (clearing) delete s.logs[key][habitId];
    else s.logs[key][habitId] = { status, tier, at: Date.now(), note };
    if (Object.keys(s.logs[key]).length === 0) delete s.logs[key];
  });

  // XP is granted once, on the transition into a completed state. A deliberate
  // undo later does NOT claw it back — punishing that teaches you to lie to
  // your own tracker. A misclick is a different thing, and `undoTick` below
  // handles it; the amount is recorded on the entry so the reversal can be
  // exact rather than a guess at what the combo happened to be at the time.
  if (!clearing && (status === STATUS.DONE || status === STATUS.PARTIAL) && !existing) {
    // Paid by the habit's rank rather than a flat rate — see payoutFor().
    const pay = payoutFor(habit.difficulty);
    const base = status === STATUS.PARTIAL
      ? pay.partial
      : (tier === 'tiny' ? pay.tiny : pay.full);
    const streak = streakOf(habit, getState(), key);
    const paid = grantXp(base * comboMultiplier(streak), CATEGORY_ATTR[habit.category] || 'aql');
    mutate((s) => {
      const e = s.logs[key]?.[habitId];
      if (e) { e.xp = paid.gained; e.attr = CATEGORY_ATTR[habit.category] || 'aql'; }
    }, { silent: true });
  }
  return clearing ? null : status;
}

/** How long a tick stays a misclick rather than a decision. */
export const UNDO_MS = 12000;

/**
 * Reverse a tick that should never have happened.
 *
 * Distinct from tapping the circle again, which clears the day but keeps the
 * XP. This is for the case where your thumb hit the wrong row: inside a short
 * window the XP was never earned, so it is taken back exactly — including from
 * the attribute it was filed under, or the radar on Me keeps a ghost of it.
 *
 * Outside the window it degrades to an ordinary clear and the XP stays, which
 * preserves the rule that actually matters: nothing you really did can be
 * taken off you later.
 */
export function undoTick(habitId, key) {
  const state = getState();
  const entry = state.logs[key]?.[habitId];
  if (!entry) return false;
  const fresh = Date.now() - (entry.at || 0) <= UNDO_MS;
  const paid = fresh ? Number(entry.xp) || 0 : 0;

  mutate((s) => {
    delete s.logs[key][habitId];
    if (Object.keys(s.logs[key]).length === 0) delete s.logs[key];
    if (paid) {
      s.game.xp = Math.max(0, s.game.xp - paid);
      const a = entry.attr;
      if (a && a in s.game.attrXp) s.game.attrXp[a] = Math.max(0, s.game.attrXp[a] - paid);
      // The level derives from xp and follows on its own, but lastLevel is
      // stored — leaving it high would swallow the next real level-up.
      s.game.lastLevel = playerLevel(s).level;
    }
  });
  return { undone: true, refunded: paid };
}

/* --------------------------------------------------------------- streaks */

/**
 * Consecutive due-days completed, counting back from `key`.
 * Today not being done yet does not break the streak — a streak should not
 * flicker off at 00:01 and shame you before the day has even happened.
 */
export function streakOf(habit, state = getState(), key = todayKey()) {
  if (habit.cadence?.type === 'times') return weeklyStreakOf(habit, state, key);
  const today = todayKey();
  let streak = 0;
  let cur = key;
  let guard = 0;
  while (guard++ < 1000) {
    if (!isDue(habit, cur)) { cur = addDays(cur, -1); continue; }
    const st = statusOf(state, cur, habit.id);
    if (st === STATUS.DONE || st === STATUS.PARTIAL) streak += 1;
    else if (st === STATUS.SKIP) { /* a planned rest day preserves the streak */ }
    else if (cur === today) { /* today is still open, not yet a miss */ }
    else break;
    cur = addDays(cur, -1);
  }
  return streak;
}

/** For 'times per week' habits: consecutive weeks that hit the target. */
function weeklyStreakOf(habit, state, key) {
  const target = habit.cadence.perWeek || 3;
  const thisWeekStart = weekOf(todayKey())[0];
  let streak = 0;
  let cursor = key;
  let guard = 0;
  while (guard++ < 200) {
    const week = weekOf(cursor);
    const done = week.filter((k) => statusOf(state, k, habit.id) === STATUS.DONE).length;
    if (done >= target) streak += 1;
    else if (week[0] === thisWeekStart) { /* current week still in progress */ }
    else break;
    cursor = addDays(week[0], -1);
  }
  return streak;
}

export function bestStreakOf(habit, state = getState()) {
  const days = Object.keys(state.logs).sort();
  let best = 0;
  for (const d of days) {
    const s = streakOf(habit, state, d);
    if (s > best) best = s;
  }
  return best;
}

/** Fraction of due days completed over the last n days. */
export function completionRate(habit, state = getState(), n = 30) {
  const days = lastNDays(n).filter((k) => isDue(habit, k) && k <= todayKey());
  if (!days.length) return 0;
  const done = days.filter((k) => {
    const st = statusOf(state, k, habit.id);
    return st === STATUS.DONE || st === STATUS.PARTIAL;
  }).length;
  return done / days.length;
}

/**
 * "Never miss twice." Lally et al. (2010) found a single missed day does not
 * measurably harm habit formation — two in a row is where it unravels.
 * A habit is AT RISK if yesterday was due and missed, and today is still open.
 */
export function atRisk(habit, state = getState(), key = todayKey()) {
  const y = addDays(key, -1);
  // A habit you only created today cannot have been missed yesterday. Without
  // this guard the app greets a brand-new user with a list of failures.
  if (dayKey(new Date(habit.createdAt)) > y) return false;
  if (!isDue(habit, y)) return false;
  const yStatus = statusOf(state, y, habit.id);
  if (yStatus === STATUS.DONE || yStatus === STATUS.PARTIAL || yStatus === STATUS.SKIP) return false;
  const tStatus = statusOf(state, key, habit.id);
  return !(tStatus === STATUS.DONE || tStatus === STATUS.PARTIAL);
}

/* There is deliberately no app-wide streak. "At least one habit today" is not a
   chain you can act on — you can hold it for a hundred days doing the easiest
   habit on the list — and shown next to the real per-habit chains it only
   diluted them. streakOf() above is the only streak in the app. */

/** Days since this habit was first logged — measured against the ~66-day marker. */
export function ageInDays(habit, state = getState()) {
  const first = Object.keys(state.logs).sort().find((k) => state.logs[k][habit.id]);
  if (!first) return 0;
  return Math.max(0, daysBetween(first, todayKey()));
}

/* -------------------------------------------------------- the day's plan */

/** Effective sort time (minutes since midnight) for ordering the day. */
export function scheduleMinutes(habit, prayerTimes, key = todayKey()) {
  // A time you set for today outranks everything, including the prayer anchor:
  // it is the most recent and most specific thing you said about this habit.
  if (habit.todayAt && habit.todayAt.day === key && typeof habit.todayAt.at === 'number') {
    return habit.todayAt.at;
  }
  if (typeof habit.reminderAt === 'number') return habit.reminderAt;
  if (habit.anchorPrayer && prayerTimes?.[habit.anchorPrayer] != null) {
    return prayerTimes[habit.anchorPrayer] + 1;   // just after the prayer
  }
  const slot = SLOTS[habit.slot] || SLOTS.anytime;
  return slot.id === 'anytime' ? 24 * 60 + 30 : slot.from;
}

/**
 * The ordered list of habits for a day, resolved against prayer times and
 * habit-stacking order. This is what the Today screen renders.
 */
export function dayPlan(state = getState(), key = todayKey()) {
  const times = prayerTimesFor(key, state.settings);
  const items = state.habits
    .filter((h) => isDue(h, key))
    .map((h) => ({ habit: h, at: scheduleMinutes(h, times, key) }));

  // Habit stacking: a stacked habit sits immediately after its anchor habit.
  const byId = new Map(items.map((x) => [x.habit.id, x]));
  for (const item of items) {
    const anchor = item.habit.anchorHabitId && byId.get(item.habit.anchorHabitId);
    if (anchor && anchor !== item) item.at = anchor.at + 0.5;
  }

  items.sort((a, b) =>
    a.at - b.at ||
    (a.habit.order - b.habit.order) ||
    a.habit.title.localeCompare(b.habit.title));

  return { times, items };
}

/** How much of today is done: {done, total, pct}. */
export function dayProgress(state = getState(), key = todayKey()) {
  const counted = state.habits.filter((h) => {
    if (!isDue(h, key)) return false;
    if (h.cadence?.type !== 'times') return true;
    // A weekly-target habit only counts toward "today" while it is still owed.
    return (weeklyRemaining(h, state, key) ?? 0) > 0 || !!statusOf(state, key, h.id);
  });
  const done = counted.filter((h) => {
    const st = statusOf(state, key, h.id);
    return st === STATUS.DONE || st === STATUS.PARTIAL || st === STATUS.SKIP;
  }).length;
  return { done, total: counted.length, pct: counted.length ? done / counted.length : 0 };
}

/* -------------------------------------------------------------- mutations */

/**
 * Turn a library entry into an addHabit() patch.
 *
 * Both places that add a library habit — the onboarding budget screen and the
 * library browser — used to build this object inline, and both had dropped
 * `difficulty`. Every habit taken from the library therefore fell back to the
 * default tier and cost 45 XP no matter what price the screen had just charged
 * you: pick the 160 XP Fajr habit and you would end up holding a 45 XP one. The
 * budget looked like it was working and was not.
 *
 * One mapping, in one place, so the two can never disagree again.
 */
export function fromLibrary(item) {
  return {
    title: item.title,
    category: item.category,
    difficulty: item.difficulty,
    emoji: item.emoji || '',
    icon: item.icon || 'check',
    slot: item.slot || 'anytime',
    anchorPrayer: item.anchorPrayer || null,
    cadence: item.cadence || { type: 'daily' },
    cue: item.cue || '',
    tiny: item.tiny || '',
    full: item.full || '',
    why: item.why || '',
    evidence: item.evidence || null,
    proof: item.proof || null,
  };
}

/**
 * Put a time on a habit.
 *
 * `mode` is 'today' for a one-off or 'always' for a standing time; passing a
 * null time clears whichever one `mode` names. The two live in separate fields
 * so that setting one never silently edits the other — the commonest way a
 * scheduler surprises somebody is by turning "just this once" into a rule.
 */
export function scheduleHabit(id, minutes, mode = 'always', key = todayKey()) {
  mutate((s) => {
    const hab = s.habits.find((x) => x.id === id);
    if (!hab) return false;
    if (mode === 'today') hab.todayAt = minutes == null ? null : { day: key, at: minutes };
    else hab.reminderAt = minutes == null ? null : minutes;
  });
  return true;
}

/** The time showing on a habit for a given day, and where it came from. */
export function scheduleOf(habit, key = todayKey()) {
  if (habit.todayAt && habit.todayAt.day === key && typeof habit.todayAt.at === 'number') {
    return { at: habit.todayAt.at, mode: 'today' };
  }
  if (typeof habit.reminderAt === 'number') return { at: habit.reminderAt, mode: 'always' };
  return { at: null, mode: null };
}

export function addHabit(patch) {
  const habit = makeHabit({ ...patch, order: getState().habits.length });
  mutate((s) => { s.habits.push(habit); });
  syncSpent();
  return habit;
}

export function updateHabit(id, patch) {
  mutate((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (!h) return false;
    Object.assign(h, patch);
  });
}

/** Archiving refunds the habit's cost, because the budget is derived from the
 *  active set — putting one away releases exactly what it was holding. */
export function archiveHabit(id, archived = true) {
  updateHabit(id, { archived });
  syncSpent();
}

/** Hard delete, including every log entry. Only ever called behind a confirm. */
export function deleteHabit(id) {
  mutate((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
    for (const key of Object.keys(s.logs)) {
      delete s.logs[key][id];
      if (!Object.keys(s.logs[key]).length) delete s.logs[key];
    }
    for (const h of s.habits) if (h.anchorHabitId === id) h.anchorHabitId = null;
  });
  syncSpent();
}

export function reorderHabits(orderedIds) {
  mutate((s) => {
    orderedIds.forEach((id, i) => {
      const h = s.habits.find((x) => x.id === id);
      if (h) h.order = i;
    });
  });
}
