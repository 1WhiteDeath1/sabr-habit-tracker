// trials.js — accepting, measuring and settling a seven-day trial.
//
// The measurement rule that matters: everything is counted inside the trial's
// own window. The main quest chains all count lifetime totals, which is correct
// for an achievement and useless for a challenge — a trial you can satisfy with
// work you did in March is not a trial. So none of `goalValue` is reused here;
// every metric below re-counts from the raw logs between two day keys.

import { getState, mutate } from './store.js';
import { STATUS } from './schema.js';
import { todayKey, addDays, rangeKeys, daysBetween } from './dates.js';
import { grantXp } from './game.js';
import { isDue, statusOf } from './habits.js';
import { keptOn } from './streak.js';
import { TRIALS, TRIAL_BY_ID, TRIAL_DAYS, TIERS, TIER_ORDER, daysOf } from '../data/trials.js';

export { TRIALS, TRIAL_BY_ID, TRIAL_DAYS, TIERS, TIER_ORDER, daysOf };

/** Anything short of the target but at or above this still pays something. */
const PARTIAL_AT = 0.5;
const PARTIAL_SHARE = 0.25;

const DONE = new Set([STATUS.DONE, STATUS.PARTIAL]);

/* ------------------------------------------------------------- measuring */

function normalize(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Days in [from, to] where a habit whose title matches was completed. */
function habitDays(state, from, to, match) {
  const ids = new Set(state.habits
    .filter((hab) => normalize(hab.title).includes(match) || normalize(hab.tiny).includes(match))
    .map((hab) => hab.id));
  if (!ids.size) return 0;
  let n = 0;
  for (const day of rangeKeys(from, to)) {
    const log = state.logs[day];
    if (!log) continue;
    if (Object.keys(log).some((id) => ids.has(id) && DONE.has(log[id].status))) n += 1;
  }
  return n;
}

/**
 * Progress inside the window, and never past today — counting a day that has
 * not happened yet would let a trial read as complete before it is.
 */
export function trialProgress(rec, state = getState()) {
  const spec = TRIAL_BY_ID[rec.id];
  if (!spec) return { value: 0, target: 1, pct: 0, met: false };

  const from = rec.from;
  const to = [rec.to, todayKey()].sort()[0];   // whichever is earlier
  let value = 0;

  switch (spec.metric) {
    case 'habitDays':
      value = habitDays(state, from, to, spec.args.match);
      break;
    case 'keptDays':
      value = rangeKeys(from, to).filter((d) => keptOn(d, state) === true).length;
      break;
    case 'perfectDays':
      value = rangeKeys(from, to).filter((day) => {
        const due = state.habits.filter((hab) => isDue(hab, day));
        return due.length > 0 && due.every((hab) => DONE.has(statusOf(state, day, hab.id)));
      }).length;
      break;
    case 'studyDays': {
      const per = {};
      for (const e of state.academics.study || []) {
        if (e.day >= from && e.day <= to) per[e.day] = (per[e.day] || 0) + (e.minutes || 0);
      }
      value = Object.values(per).filter((m) => m >= 15).length;
      break;
    }
    case 'classesAttended':
      for (const book of Object.values(state.academics.attendance || {})) {
        for (const [day, st] of Object.entries(book)) {
          if (day >= from && day <= to && st === 'present') value += 1;
        }
      }
      break;
    case 'focusSessions':
      value = (state.focus.sessions || []).filter((s) => {
        if (!s.completed || !s.at) return false;
        const d = new Date(s.at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key >= from && key <= to;
      }).length;
      break;
    case 'cleanDays': {
      // Consecutive from the start of the trial: one lapse ends this one, which
      // is the only metric here where a single bad day is decisive. Said plainly
      // on the card so it is never a surprise.
      const lapses = new Set((state.recovery.lapses || []).map((l) => l.day || l.date));
      let run = 0;
      for (const day of rangeKeys(from, to)) {
        if (lapses.has(day)) { run = 0; continue; }
        run += 1;
      }
      value = run;
      break;
    }
    default:
      value = 0;
  }

  const target = spec.target;
  return { value: Math.min(value, target), raw: value, target, pct: Math.min(1, value / target), met: value >= target };
}

/* ------------------------------------------------------------- the state */

export function activeTrial(state = getState()) {
  const rec = state.game.trial;
  if (!rec || rec.settled) return null;
  return rec;
}

/** Days left, counting today as one of them. */
export function daysLeft(rec) {
  return Math.max(0, daysBetween(todayKey(), rec.to) + 1);
}

/** Is this trial's week over? */
export function isExpired(rec) {
  return todayKey() > rec.to;
}

/** Has this trial ever been won? Escalation and the record both need it. */
export function hasWon(id, state = getState()) {
  return (state.game.trialHistory || []).some((h) => h.id === id && h.outcome === 'won');
}

/** How many times, for the record. */
export function timesWon(id, state = getState()) {
  return (state.game.trialHistory || []).filter((h) => h.id === id && h.outcome === 'won').length;
}

/** Everything currently possible to take. */
export function available(state = getState()) {
  const recent = new Set((state.game.trialHistory || []).slice(-2).map((h) => h.id));
  return TRIALS.filter((t) => {
    if (t.needs === 'academics' && !state.academics.enabled) return false;
    if (t.needs === 'recovery' && !state.recovery.enabled) return false;
    if (t.needs === 'focus' && !(state.focus.sessions || []).length
        && !state.game.owned?.some((o) => o.id === 'focus')) return false;
    if (t.metric === 'habitDays') {
      const has = state.habits.some((hab) => !hab.archived
        && (normalize(hab.title).includes(t.args.match) || normalize(hab.tiny).includes(t.args.match)));
      if (!has) return false;
    }
    // A fortnight is only offered once its week has been held, so the long
    // version of something is never the first thing you try and fail.
    if (t.requires && !hasWon(t.requires, state)) return false;
    return !recent.has(t.id);
  });
}

/**
 * What to put in front of you: the best one from each tier.
 *
 * One of each rather than three of whatever, so the choice is always "how much
 * am I taking on" and never "which of three identical weeks". Within a tier
 * something never won outranks a repeat, because the collection is worth
 * filling before it is worth farming.
 */
export function offered(state = getState()) {
  const pool = available(state);
  const out = [];
  for (const tier of TIER_ORDER) {
    const inTier = pool.filter((t) => t.tier === tier);
    if (!inTier.length) continue;
    const fresh = inTier.filter((t) => !hasWon(t.id, state));
    const from = fresh.length ? fresh : inTier;
    // Stable per day, so the offer does not reshuffle while you look at it.
    const seed = Number(todayKey().replace(/-/g, '')) % from.length;
    out.push(from[seed]);
  }
  return out;
}

export function acceptTrial(id) {
  const spec = TRIAL_BY_ID[id];
  if (!spec || activeTrial()) return null;
  const from = todayKey();
  const rec = { id, from, to: addDays(from, daysOf(spec) - 1), acceptedAt: Date.now(), settled: false };
  mutate((s) => { s.game.trial = rec; });
  return rec;
}

/** Abandon it. No cost — a trial you cannot walk away from is a punishment. */
export function abandonTrial() {
  const rec = activeTrial();
  if (!rec) return null;
  mutate((s) => {
    s.game.trial = null;
    if (!Array.isArray(s.game.trialHistory)) s.game.trialHistory = [];
    s.game.trialHistory.push({ ...rec, outcome: 'abandoned', endedAt: Date.now() });
  });
  return rec;
}

/**
 * Close out a finished trial.
 *
 * Three outcomes and none of them is a penalty: the full reward, a quarter of
 * it for getting at least halfway, or nothing gained — never anything lost. XP
 * already earned from the underlying habits is untouched either way, so a trial
 * you miss costs you exactly the bonus and not one point more.
 */
export function settleTrial() {
  const rec = activeTrial();
  if (!rec) return null;
  const spec = TRIAL_BY_ID[rec.id];
  const p = trialProgress(rec);
  if (!p.met && !isExpired(rec)) return null;

  const outcome = p.met ? 'won' : p.pct >= PARTIAL_AT ? 'partial' : 'missed';
  const xp = outcome === 'won' ? spec.xp
    : outcome === 'partial' ? Math.round(spec.xp * PARTIAL_SHARE) : 0;

  mutate((s) => {
    s.game.trial = null;
    if (!Array.isArray(s.game.trialHistory)) s.game.trialHistory = [];
    s.game.trialHistory.push({ ...rec, outcome, value: p.raw, target: p.target, xp, endedAt: Date.now() });
  });
  if (xp) grantXp(xp, spec.attr);
  return { outcome, xp, value: p.raw, target: p.target, spec };
}

/**
 * Am I still on for this, and how much slack is left?
 *
 * The most important number in the mechanic and the one most apps never show.
 * A seven-day trial needing six is a trial you can miss one day of, and
 * knowing that is the whole difference between a bad Tuesday and quitting on
 * Tuesday. When the full mark does go out of reach this says so plainly and
 * points at the partial, rather than letting the thing rot silently for
 * another nine days.
 */
export function pace(rec, state = getState()) {
  const p = trialProgress(rec, state);
  const today = todayKey();
  const left = Math.max(0, daysBetween(today, rec.to) + 1);   // today included
  const need = Math.max(0, p.target - p.raw);
  const slack = left - need;

  if (p.met) return { state: 'won', left, need: 0, slack, p };
  if (today > rec.to) return { state: 'over', left: 0, need, slack, p };
  if (slack < 0) return { state: 'shortfall', left, need, slack, p };
  return { state: slack === 0 ? 'tight' : 'ok', left, need, slack, p };
}

/** One line of plain English for whatever pace() worked out. */
export function paceLine(rec, state = getState()) {
  const q = pace(rec, state);
  const d = (n) => n + ' day' + (n === 1 ? '' : 's');
  switch (q.state) {
    case 'won':
      return 'Held. Claim it.';
    case 'over':
      return 'The window has closed.';
    case 'shortfall':
      return 'The full mark is out of reach, but ' + q.p.raw + ' of ' + q.p.target
        + ' still pays a quarter and every day you add is on the record either way.';
    case 'tight':
      return d(q.need) + ' left to earn and ' + d(q.left) + ' to do it in. Every one counts from here.';
    default:
      return d(q.need) + ' to go, ' + d(q.left) + ' left. You can still miss ' + d(q.slack) + '.';
  }
}

/** A finished trial waiting to be closed out — won early, or the week is over. */
export function trialDue(state = getState()) {
  const rec = activeTrial(state);
  if (!rec) return null;
  const p = trialProgress(rec, state);
  return p.met || isExpired(rec) ? { rec, progress: p, spec: TRIAL_BY_ID[rec.id] } : null;
}

/**
 * The collection.
 *
 * Only wins score. Attempts that fell short stay in the history and read as
 * "held partway" rather than as losses, because the promise of the whole
 * mechanic is that choosing to try something costs nothing when it does not
 * come off.
 */
export function trialRecord(state = getState()) {
  const h = state.game.trialHistory || [];
  const won = h.filter((x) => x.outcome === 'won');
  const byTier = {};
  for (const tier of TIER_ORDER) {
    const all = TRIALS.filter((t) => t.tier === tier);
    byTier[tier] = {
      ...TIERS[tier],
      total: all.length,
      won: all.filter((t) => hasWon(t.id, state)).length,
      trials: all.map((t) => ({
        ...t,
        wins: timesWon(t.id, state),
        locked: !!(t.requires && !hasWon(t.requires, state)),
      })),
    };
  }
  return {
    won: won.length,
    attempted: h.length,
    xp: won.reduce((n, x) => n + (Number(x.xp) || 0), 0),
    distinct: new Set(won.map((x) => x.id)).size,
    byTier,
    history: h.slice().reverse(),
  };
}
