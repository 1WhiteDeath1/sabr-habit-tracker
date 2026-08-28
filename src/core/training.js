// training.js — the reps ladder: what your round is, what you did, and the one
// number that shows it getting easier.
//
// ---------------------------------------------------------------------------
// The rules this module is built on
//
//   1. A missed day costs nothing. There is no chain here, nothing decays,
//      nothing turns red, and nothing is ever subtracted. Come back after two
//      weeks off and the screen says how many days you have trained in total,
//      not how many you dropped. Every other design leads to the same place:
//      you miss a Tuesday, the app makes you feel it, and you stop opening it.
//
//   2. Under the target still counts. Three push-ups is three push-ups. The
//      score is pro rata, so a bad day is a small bar rather than no bar.
//
//   3. The rung is part of the score. Ten wall push-ups and ten real push-ups
//      are not the same work — see data/exercises.js — so moving up the ladder
//      moves the graph even when the rep count stays the same. That is what
//      makes "am I actually getting stronger" answerable rather than a feeling.
//
//   4. Nothing steps up without you. The app will tell you when you have
//      cleared a rung enough times to move on, once, and then leave it alone.

import { getState, mutate } from './store.js';
import { grantXp } from './game.js';
import { uid } from './schema.js';
import { todayKey, lastNDays, addDays } from './dates.js';
import { MOVEMENTS, MOVEMENT_ORDER, UNIT, rung, rungIndex, nextRung, prevRung, routine } from '../data/exercises.js';

/**
 * XP, and its ceiling.
 *
 * Paid per point of work rather than per set, so a set of three counts for
 * three and grinding out a hundred push-ups is not worth a hundred times a
 * habit. The daily ceiling is about three habits' worth: training a full
 * session is one of the better things you can do with an evening, and it is
 * still not worth more than the rest of the day put together.
 */
export const TRAIN_XP = {
  firstSet: 10,      // showing up at all, once a day
  perPoint: 0.3,
  dayCap: 45,
};

/** How many separate days you must hit a rung's target before it offers the
 *  next one. Three, because twice is luck and five is a chore. */
export const STEP_UP_HITS = 3;
/** ...counted within this window, so a target you cleared last spring does not
 *  push you up a ladder you have since come down. */
export const STEP_UP_WINDOW = 28;

/* ------------------------------------------------------------------ plan */

/** The round you are on: one rung per movement, in order. Unknown ids are
 *  dropped rather than crashing a screen — data can outlive a rename. */
export function plan(state = getState()) {
  const raw = Array.isArray(state.training?.plan) ? state.training.plan : [];
  return raw
    .filter((p) => p && rung(p.mid, p.rung))
    .map((p) => ({ mid: p.mid, rung: p.rung }));
}

export function hasPlan(state = getState()) {
  return plan(state).length > 0;
}

export function goalRounds(state = getState()) {
  const n = Number(state.training?.goalRounds);
  return Number.isFinite(n) && n >= 1 ? Math.min(10, Math.round(n)) : 1;
}

export function setGoalRounds(n) {
  mutate((s) => {
    s.training.goalRounds = Math.max(1, Math.min(10, Math.round(Number(n) || 1)));
  });
}

/** Replace the whole round. Order is preserved exactly as given. */
export function setPlan(next) {
  const clean = (next || []).filter((p) => p && rung(p.mid, p.rung)).map((p) => ({ mid: p.mid, rung: p.rung }));
  mutate((s) => {
    s.training.plan = clean;
    if (!s.training.startedAt && clean.length) s.training.startedAt = Date.now();
  });
  return clean;
}

/** Adopt one of the starting routines from data/exercises.js. */
export function applyRoutine(id) {
  const r = routine(id);
  if (!r) return null;
  setPlan(r.plan.map(([mid, rid]) => ({ mid, rung: rid })));
  return r;
}

/** Move one movement to a different rung, keeping its place in the round. */
export function setRung(mid, rid) {
  if (!rung(mid, rid)) return false;
  mutate((s) => {
    const item = (s.training.plan || []).find((p) => p.mid === mid);
    if (item) item.rung = rid;
    else s.training.plan.push({ mid, rung: rid });
    if (!s.training.startedAt) s.training.startedAt = Date.now();
  });
  return true;
}

export function removeMovement(mid) {
  mutate((s) => { s.training.plan = (s.training.plan || []).filter((p) => p.mid !== mid); });
}

/** Movements not currently in the round, for the "add one" list. */
export function spareMovements(state = getState()) {
  const inPlan = new Set(plan(state).map((p) => p.mid));
  return MOVEMENT_ORDER.filter((mid) => !inPlan.has(mid)).map((mid) => MOVEMENTS[mid]);
}

/* ------------------------------------------------------------------- log */

function blankDay() { return { sets: [], paid: 0 }; }

export function dayLog(state = getState(), key = todayKey()) {
  const d = state.training?.log?.[key];
  if (!d || !Array.isArray(d.sets)) return blankDay();
  return { sets: d.sets, paid: Number(d.paid) || 0 };
}

export function setsToday(state = getState(), mid = null, key = todayKey()) {
  const sets = dayLog(state, key).sets;
  return mid ? sets.filter((x) => x.mid === mid) : sets;
}

/**
 * What one set is worth.
 *
 * Pro rata against the rung's target, and over-target sets keep counting — this
 * is deliberately not capped at 100%, because the day you do fifteen instead of
 * ten is exactly the day the graph should notice.
 */
export function scoreSet(mid, rid, reps) {
  const r = rung(mid, rid);
  if (!r) return 0;
  const n = Math.max(0, Number(reps) || 0);
  return Math.round((n / r.target) * r.pts * 10) / 10;
}

/**
 * Record one set. `reps` defaults to the rung's target — the common case is a
 * single tap on the row, not typing a number.
 *
 * Returns what happened, so the screen can celebrate a finished round without
 * recomputing any of it.
 */
export function logSet(mid, reps = null, at = Date.now()) {
  const state = getState();
  const item = plan(state).find((p) => p.mid === mid);
  const rid = item ? item.rung : null;
  const r = rid ? rung(mid, rid) : null;
  if (!r) return null;

  const key = todayKey();
  const n = Math.max(1, Math.min(999, Math.round(Number(reps ?? r.target) || r.target)));
  const score = scoreSet(mid, rid, n);
  const before = roundsDone(state, key);
  const first = dayLog(state, key).sets.length === 0;

  let paidNow = 0;
  const entry = { id: uid('ts'), mid, rung: rid, reps: n, unit: r.unit, score, at };

  mutate((s) => {
    if (!s.training.log || typeof s.training.log !== 'object') s.training.log = {};
    const day = s.training.log[key] || blankDay();
    day.sets = Array.isArray(day.sets) ? day.sets : [];
    day.sets.push(entry);

    // The ceiling is applied here, once, and the amount actually paid is stored
    // on the day. Recomputing it from the sets later would silently re-pay a
    // capped day every time the ladder's points were tuned.
    const want = Math.round(score * TRAIN_XP.perPoint) + (first ? TRAIN_XP.firstSet : 0);
    paidNow = Math.max(0, Math.min(Math.max(want, first ? TRAIN_XP.firstSet : 2), TRAIN_XP.dayCap - (Number(day.paid) || 0)));
    day.paid = (Number(day.paid) || 0) + paidNow;
    s.training.log[key] = day;
    prune(s);
  });

  if (paidNow) grantXp(paidNow, 'jasad');

  const after = roundsDone(getState(), key);
  return {
    set: entry,
    xp: paidNow,
    score,
    roundFinished: after > before,
    rounds: after,
    capped: paidNow === 0,
  };
}

/** Take back the last set of a movement today. Undo, not punishment — the XP
 *  it paid is left alone, exactly as un-ticking a habit is handled elsewhere. */
export function undoLastSet(mid) {
  const key = todayKey();
  let removed = null;
  mutate((s) => {
    const day = s.training.log?.[key];
    if (!day || !day.sets?.length) return false;
    for (let i = day.sets.length - 1; i >= 0; i--) {
      if (!mid || day.sets[i].mid === mid) { removed = day.sets.splice(i, 1)[0]; break; }
    }
    if (!removed) return false;
    if (!day.sets.length) delete s.training.log[key];
  });
  return removed;
}

/** Keep two years of days. Longer than any graph in the app reads. */
function prune(s) {
  const keys = Object.keys(s.training.log || {});
  if (keys.length <= 730) return;
  keys.sort();
  for (const k of keys.slice(0, keys.length - 730)) delete s.training.log[k];
}

/* --------------------------------------------------------------- rounds */

/**
 * A round is one set of everything in the plan, so the number of rounds you
 * have finished is the smallest per-movement set count. Derived, never stored:
 * changing the plan mid-day therefore re-reads the day honestly instead of
 * leaving a counter that no longer matches what is on the screen.
 */
export function roundsDone(state = getState(), key = todayKey()) {
  const items = plan(state);
  if (!items.length) return 0;
  const sets = dayLog(state, key).sets;
  let min = Infinity;
  for (const it of items) {
    min = Math.min(min, sets.filter((x) => x.mid === it.mid).length);
    if (min === 0) return 0;
  }
  return min === Infinity ? 0 : min;
}

/** What is left to touch once before this round closes. */
export function remainingInRound(state = getState(), key = todayKey()) {
  const items = plan(state);
  const done = roundsDone(state, key);
  const sets = dayLog(state, key).sets;
  return items.filter((it) => sets.filter((x) => x.mid === it.mid).length <= done);
}

/* --------------------------------------------------------------- scores */

export function dayScore(state = getState(), key = todayKey()) {
  return Math.round(dayLog(state, key).sets.reduce((sum, x) => sum + (Number(x.score) || 0), 0));
}

export function dayReps(state = getState(), key = todayKey()) {
  return dayLog(state, key).sets.reduce((sum, x) => sum + (x.unit === UNIT.SEC ? 0 : Number(x.reps) || 0), 0);
}

/** [{key, score, sets}] oldest first, for the chart. */
export function history(state = getState(), days = 21, endKey = todayKey()) {
  return lastNDays(days, endKey).map((key) => {
    const d = dayLog(state, key);
    return { key, score: dayScore(state, key), sets: d.sets.length };
  });
}

export function trainedDays(state = getState()) {
  const log = state.training?.log || {};
  return Object.keys(log).filter((k) => (log[k]?.sets || []).length > 0).length;
}

export function bestDay(state = getState()) {
  const log = state.training?.log || {};
  let best = { key: null, score: 0 };
  for (const key of Object.keys(log)) {
    const score = dayScore(state, key);
    if (score > best.score) best = { key, score };
  }
  return best;
}

export function lifetimeScore(state = getState()) {
  const log = state.training?.log || {};
  return Object.keys(log).reduce((sum, k) => sum + dayScore(state, k), 0);
}

/** Total score over the n days ending at `endKey`, inclusive. */
function windowScore(state, n, endKey) {
  return lastNDays(n, endKey).reduce((sum, k) => sum + dayScore(state, k), 0);
}

/**
 * The headline: this week's work against the week before it.
 *
 * Weeks rather than days, because a single rest day would otherwise read as
 * a collapse — which is exactly the framing this screen exists to avoid.
 * Returns `delta: null` until there is a previous week with anything in it, so
 * the app never announces a 0% change to somebody on day two.
 */
export function stamina(state = getState(), endKey = todayKey()) {
  const week = windowScore(state, 7, endKey);
  const prev = windowScore(state, 7, addDays(endKey, -7));
  const delta = prev > 0 ? Math.round(((week - prev) / prev) * 100) : null;
  return { week, prev, delta, avg: Math.round(week / 7) };
}

/* ------------------------------------------------------------ the ladder */

/** Your best single set on a rung, ever. */
export function bestSet(state = getState(), mid, rid) {
  const log = state.training?.log || {};
  let best = 0;
  for (const key of Object.keys(log)) {
    for (const s of log[key]?.sets || []) {
      if (s.mid === mid && s.rung === rid) best = Math.max(best, Number(s.reps) || 0);
    }
  }
  return best;
}

/** Days on which a rung's target was cleared in one set, within the window. */
export function targetHits(state = getState(), mid, rid, window = STEP_UP_WINDOW) {
  const r = rung(mid, rid);
  if (!r) return [];
  const log = state.training?.log || {};
  const from = addDays(todayKey(), -(window - 1));
  return Object.keys(log)
    .filter((key) => key >= from)
    .filter((key) => (log[key]?.sets || []).some((s) => s.mid === mid && s.rung === rid && (Number(s.reps) || 0) >= r.target))
    .sort();
}

function declinedKey(mid, rid) { return `${mid}:${rid}`; }

/**
 * Whether this movement has earned the next rung — and it is only ever an
 * offer. Returns null once you have said no to this particular step, so the
 * app asks once and then stops having an opinion.
 */
export function stepUpReady(state = getState(), mid) {
  const item = plan(state).find((p) => p.mid === mid);
  if (!item) return null;
  const next = nextRung(mid, item.rung);
  if (!next) return null;
  const declined = Array.isArray(state.training?.declined) ? state.training.declined : [];
  if (declined.includes(declinedKey(mid, item.rung))) return null;
  const hits = targetHits(state, mid, item.rung);
  if (hits.length < STEP_UP_HITS) return null;
  return { mid, from: rung(mid, item.rung), to: next, hits: hits.length };
}

export function anyStepUp(state = getState()) {
  for (const p of plan(state)) {
    const r = stepUpReady(state, p.mid);
    if (r) return r;
  }
  return null;
}

export function stepUp(mid) {
  const item = plan().find((p) => p.mid === mid);
  if (!item) return null;
  const next = nextRung(mid, item.rung);
  if (!next) return null;
  setRung(mid, next.id);
  return next;
}

export function stepDown(mid) {
  const item = plan().find((p) => p.mid === mid);
  if (!item) return null;
  const prev = prevRung(mid, item.rung);
  if (!prev) return null;
  setRung(mid, prev.id);
  // Coming down clears any refusal on the rung below, so the offer can come
  // back later. Stepping down is meant to be a free move, not a one-way door.
  mutate((s) => {
    s.training.declined = (s.training.declined || []).filter((k) => k !== declinedKey(mid, prev.id));
  }, { silent: true });
  return prev;
}

/** "Not yet" on a step-up offer. Remembered against the rung you are on, so it
 *  returns by itself the next time you move. */
export function declineStepUp(mid) {
  const item = plan().find((p) => p.mid === mid);
  if (!item) return;
  mutate((s) => {
    const list = Array.isArray(s.training.declined) ? s.training.declined : [];
    const k = declinedKey(mid, item.rung);
    if (!list.includes(k)) list.push(k);
    s.training.declined = list;
  });
}

/** How far up every ladder you stand, for the progress view. */
export function ladderPositions(state = getState()) {
  return plan(state).map((p) => {
    const m = MOVEMENTS[p.mid];
    const i = rungIndex(p.mid, p.rung);
    return {
      mid: p.mid,
      movement: m,
      rung: rung(p.mid, p.rung),
      index: i,
      total: m.rungs.length,
      best: bestSet(state, p.mid, p.rung),
      hits: targetHits(state, p.mid, p.rung).length,
      ready: stepUpReady(state, p.mid),
    };
  });
}

/** A one-line summary of the round, for Today. "5 pull-ups · 10 push-ups · 15 squats" */
export function planLine(state = getState()) {
  return plan(state).map((p) => {
    const r = rung(p.mid, p.rung);
    const name = r.short || r.label.toLowerCase();
    return r.unit === UNIT.SEC ? `${r.target}s ${name}` : `${r.target} ${name}`;
  }).join(' · ');
}
