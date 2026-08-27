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
import { TRIALS, TRIAL_BY_ID, TRIAL_DAYS } from '../data/trials.js';

export { TRIALS, TRIAL_BY_ID, TRIAL_DAYS };

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

/**
 * Which trials can be offered right now.
 *
 * Filtered by what is actually switched on and, for the habit-matching ones,
 * by whether you hold a habit that could satisfy them — offering "Seven Dawns"
 * to somebody with no Fajr habit is offering a trial that cannot be started.
 */
export function offered(state = getState()) {
  const recent = new Set((state.game.trialHistory || []).slice(-3).map((h) => h.id));
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
    return !recent.has(t.id);
  });
}

export function acceptTrial(id) {
  const spec = TRIAL_BY_ID[id];
  if (!spec || activeTrial()) return null;
  const from = todayKey();
  const rec = { id, from, to: addDays(from, TRIAL_DAYS - 1), acceptedAt: Date.now(), settled: false };
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

/** A finished trial waiting to be closed out — won early, or the week is over. */
export function trialDue(state = getState()) {
  const rec = activeTrial(state);
  if (!rec) return null;
  const p = trialProgress(rec, state);
  return p.met || isExpired(rec) ? { rec, progress: p, spec: TRIAL_BY_ID[rec.id] } : null;
}

export function trialRecord(state = getState()) {
  const h = state.game.trialHistory || [];
  return {
    won: h.filter((x) => x.outcome === 'won').length,
    attempted: h.length,
    history: h,
  };
}
