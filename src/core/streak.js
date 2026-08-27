// streak.js — the day streak, built so that losing it is survivable.
//
// Duolingo's streak is emotionally effective and emotionally manipulative for
// the same reason: one fragile number carries all of the accumulated value, so
// the product has to work hard — the pleading owl, the red notifications, the
// widget that watches you — to make you afraid of losing it. The cuteness is
// compensation for the fragility. Remove the fragility and the cuteness stops
// being necessary, which is why the fix for "too saccharine" and the fix for
// "I lost it so I quit" are the same fix.
//
// Three structural changes to the Duolingo model:
//
//   1. The streak is NOT the headline number. `totalKept` is — every day you
//      ever kept, monotonic, unaffected by a miss. When a run breaks, the
//      largest number on the screen does not move.
//
//   2. Milestones vest permanently. They are derived from your best run ever,
//      so passing thirty days means you have passed thirty days for good. You
//      cannot be made un-thirty-days by a bad Tuesday.
//
//   3. Rukhsah instead of Streak Freeze. A rukhsah is the concession already
//      built into the law — the traveller shortens the prayer, the ill do not
//      fast. It is not a cheat and it is not a purchase. You earn them by
//      turning up, and one is spent automatically on a day you missed.
//
// The bar for keeping a day is deliberately low: ONE habit due that day, at any
// tier, including the two-minute version. A streak you can only keep by being
// perfect is a streak that teaches you to quit, and the tiny version existing
// at all is pointless if it does not count for this.

import { getState, mutate } from './store.js';
import { STATUS } from './schema.js';
import { isDue, statusOf } from './habits.js';
import { todayKey, addDays } from './dates.js';
import { grantXp } from './game.js';

const KEPT = new Set([STATUS.DONE, STATUS.PARTIAL, STATUS.SKIP]);

/**
 * The vesting ladder.
 *
 * Ends at 365 rather than running forever: an unbounded ladder means there is
 * always a next number you have not reached, which is the treadmill this app is
 * supposed to be the opposite of. After a year the habit is the point, not the
 * counter.
 */
export const MILESTONES = [
  { days: 3,   name: 'The First Three', xp: 25,   note: 'The hardest three there are.' },
  { days: 7,   name: 'A Week Kept',     xp: 60,   note: 'Seven days. It is a real thing now.' },
  { days: 14,  name: 'A Fortnight',     xp: 120,  note: 'Two weeks. You have come through a bad day already.' },
  { days: 30,  name: 'A Month Kept',    xp: 250,  note: 'A month. Longer than most attempts ever get.' },
  { days: 66,  name: 'Automatic',       xp: 600,  note: 'Sixty-six — the median for a habit to stop needing a decision.' },
  { days: 100, name: 'A Hundred Days',  xp: 900,  note: 'Three figures.' },
  { days: 180, name: 'Half A Year',     xp: 1600, note: 'Half a year of turning up.' },
  { days: 365, name: 'A Year Kept',     xp: 3650, note: 'A year. There is no larger marker, and there does not need to be.' },
];

/** One rukhsah for every ten days kept, and you may hold two. */
export const RUKHSAH_EVERY = 10;
export const RUKHSAH_MAX = 2;

/* ------------------------------------------------------------- the days */

/**
 * Was this day kept?
 *
 * One habit, at any tier. A day with nothing due cannot be failed and returns
 * null — `runFrom` steps over those rather than counting or breaking on them.
 */
export function keptOn(key, state = getState()) {
  const due = state.habits.filter((hab) => isDue(hab, key));
  if (!due.length) return null;
  return due.some((hab) => KEPT.has(statusOf(state, key, hab.id)));
}

/** Days covered by a spent rukhsah, treated as kept for run purposes. */
function coveredSet(state) {
  return new Set(state.game.rukhsah?.covered || []);
}

/**
 * Walk backwards from `key` counting kept days.
 *
 * Today is never counted as a miss while it is still today — the run holds open
 * until the day is actually over, so opening the app at 9am does not show a
 * streak already broken by a day you have not lived yet.
 */
function runFrom(key, state) {
  const today = todayKey();
  const covered = coveredSet(state);
  let run = 0;
  let cur = key;
  for (let guard = 0; guard < 4000; guard += 1) {
    const kept = keptOn(cur, state);
    if (kept === null) { cur = addDays(cur, -1); continue; }
    if (kept || covered.has(cur)) run += 1;
    else if (cur === today) { /* still open */ }
    else break;
    cur = addDays(cur, -1);
  }
  return run;
}

/** The current run, in days. */
export function streakNow(state = getState()) {
  return runFrom(todayKey(), state);
}

/**
 * Every day ever kept. The headline number, and the whole point of the design:
 * it is monotonic, so a miss can never make it smaller.
 */
export function totalKept(state = getState()) {
  let n = 0;
  for (const day of Object.keys(state.logs)) {
    if (keptOn(day, state)) n += 1;
  }
  return n;
}

/** The longest run ever reached. Stored, because it must survive a break. */
export function bestRun(state = getState()) {
  return Math.max(Number(state.game.bestDayStreak || 0), streakNow(state));
}

/* --------------------------------------------------------- the milestones */

/**
 * Milestones vest against the best run ever, never the current one, so they
 * cannot be taken back. This is the load-bearing line in the file.
 */
export function milestones(state = getState()) {
  const best = bestRun(state);
  const now = streakNow(state);
  const claimed = state.game.milestonesClaimed || [];
  return MILESTONES.map((m) => ({
    ...m,
    earned: best >= m.days,
    current: now >= m.days,
    claimed: claimed.includes(m.days),
  }));
}

/** The next marker ahead of the current run, for the progress ring. */
export function nextMilestone(state = getState()) {
  const now = streakNow(state);
  return MILESTONES.find((m) => m.days > now) || null;
}

/**
 * A milestone reached but not yet celebrated.
 *
 * Claimed by hand rather than paid out silently, for the same reason the
 * university week bonus is: a reward that lands in a total you were not
 * watching is not a reward.
 */
export function milestoneDue(state = getState()) {
  return milestones(state).find((m) => m.earned && !m.claimed) || null;
}

export function claimMilestone(days) {
  const m = MILESTONES.find((x) => x.days === days);
  if (!m) return null;
  const st = getState();
  if ((st.game.milestonesClaimed || []).includes(days)) return null;
  if (bestRun(st) < days) return null;
  mutate((s) => {
    if (!Array.isArray(s.game.milestonesClaimed)) s.game.milestonesClaimed = [];
    s.game.milestonesClaimed.push(days);
  });
  grantXp(m.xp, 'sabr');
  return m;
}

/* ------------------------------------------------------------- rukhsah */

function rukhsahEarnedTotal(state) {
  return Math.floor(totalKept(state) / RUKHSAH_EVERY);
}

export function rukhsah(state = getState()) {
  const r = state.game.rukhsah || {};
  const earned = rukhsahEarnedTotal(state);
  const spent = (r.covered || []).length;
  const kept = totalKept(state);
  return {
    held: Math.max(0, Math.min(RUKHSAH_MAX, earned - spent)),
    max: RUKHSAH_MAX,
    earned,
    spent,
    covered: r.covered || [],
    // Days until the next one, so the number always has somewhere to go.
    toNext: RUKHSAH_EVERY - (kept % RUKHSAH_EVERY),
  };
}

/**
 * Spend concessions against days that were missed, nearest first.
 *
 * Runs on boot. Deliberately automatic: the point is that you open the app
 * after a bad Tuesday and the run is intact, not that you are handed a decision
 * about your own failure at the moment you are least able to make one.
 *
 * Only ever covers the two days behind today. A concession applicable to any
 * day in history would let someone repair a three-week gap, and at that point
 * the number has stopped describing anything.
 */
export function settleRukhsah(state = getState()) {
  const today = todayKey();
  const covered = coveredSet(state);
  const missed = [];

  for (let back = 1; back <= 2; back += 1) {
    const day = addDays(today, -back);
    if (covered.has(day)) continue;
    if (keptOn(day, state) === false) missed.push(day);
  }
  if (!missed.length) return [];

  const available = rukhsah(state).held;
  const use = missed.slice(0, available);
  if (!use.length) return [];

  mutate((s) => {
    if (!s.game.rukhsah) s.game.rukhsah = { covered: [] };
    if (!Array.isArray(s.game.rukhsah.covered)) s.game.rukhsah.covered = [];
    s.game.rukhsah.covered.push(...use);
  });
  return use;
}

/* -------------------------------------------------------------- the break */

/**
 * Record the high-water mark, and report a break not yet acknowledged.
 *
 * Called on boot, after settleRukhsah. Everything it writes is a record of what
 * happened rather than a punishment: nothing is deducted and nothing is reset
 * by this function — the run has already fallen on its own, by arithmetic.
 */
export function settleStreak(state = getState()) {
  const now = streakNow(state);
  const best = Number(state.game.bestDayStreak || 0);
  const lastSeen = Number(state.game.lastStreak || 0);

  if (now > best) mutate((s) => { s.game.bestDayStreak = now; });

  // Only a run worth naming. Below three there is nothing to mourn, and saying
  // otherwise would be the app manufacturing a loss so it can console you.
  const broke = lastSeen >= 3 && now < lastSeen;
  if (broke) {
    mutate((s) => { s.game.lastBreak = { at: Date.now(), was: lastSeen, on: todayKey(), seen: false }; });
  }
  if (now !== lastSeen) mutate((s) => { s.game.lastStreak = now; });
  return broke ? { was: lastSeen, now } : null;
}

/** An unacknowledged break, for the card that states the record plainly. */
export function pendingBreak(state = getState()) {
  const b = state.game.lastBreak;
  if (!b || b.seen) return null;
  return b;
}

export function acknowledgeBreak() {
  mutate((s) => { if (s.game.lastBreak) s.game.lastBreak.seen = true; });
}

/* ------------------------------------------------------------- the whole */

/** Everything the streak card needs, in one read. */
export function streakState(state = getState()) {
  const now = streakNow(state);
  const all = milestones(state);
  const next = MILESTONES.find((m) => m.days > now) || null;
  const floor = all.filter((m) => m.days <= now).pop()?.days || 0;
  return {
    now,
    total: totalKept(state),
    best: bestRun(state),
    next,
    toNext: next ? next.days - now : 0,
    // Measured from the last marker rather than from zero, otherwise the bar
    // barely moves across the long stretches between 100 and 180.
    pct: next ? (now - floor) / (next.days - floor) : 1,
    earned: all.filter((m) => m.earned),
    all,
    rukhsah: rukhsah(state),
    keptToday: keptOn(todayKey(), state) === true,
    due: milestoneDue(state),
  };
}
