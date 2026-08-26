// ledger.js — muhasabah, the daily self-accounting.
//
// This is where you record what you left undone and what you did wrong. It is
// the most dangerous screen in the app to get the tone wrong on, so it follows
// the same rule as Shield: **logging earns XP and never deducts it.** A ledger
// that punishes honesty stops being a ledger and becomes a thing you avoid.
//
// Two more design constraints:
//   - Every entry asks for one concrete correction. A record with no next
//     action is just rumination, and rumination makes things worse, not better.
//   - The screen reports patterns, never a running total of failures. You are
//     looking for the shape of the problem, not a scoreboard of your character.

import { getState, mutate } from './store.js';
import { grantXp } from './game.js';
import { uid } from './schema.js';
import { todayKey, lastNDays, dayKey } from './dates.js';

export const LEDGER_XP = 12;

/** Things left undone. */
export const OMISSIONS = [
  { id: 'prayer_missed',  label: 'Missed a prayer',            attr: 'ruh' },
  { id: 'prayer_late',    label: 'Prayed it late / rushed',    attr: 'ruh' },
  { id: 'quran_skipped',  label: 'Skipped Qur’an',             attr: 'ruh' },
  { id: 'duty_skipped',   label: 'Skipped uni / work I owed',  attr: 'waqt' },
  { id: 'promise_self',   label: 'Broke a promise to myself',  attr: 'sabr' },
  { id: 'promise_other',  label: 'Broke my word to someone',   attr: 'sabr' },
  { id: 'family',         label: 'Neglected family',           attr: 'ruh' },
  { id: 'body_skipped',   label: 'Skipped training / movement',attr: 'jasad' },
  { id: 'sleep_missed',   label: 'Did not sleep when I should',attr: 'waqt' },
];

/** Things actively done wrong. */
export const COMMISSIONS = [
  { id: 'wasted',    label: 'Wasted hours scrolling',     attr: 'waqt' },
  { id: 'gaze',      label: 'Did not lower my gaze',      attr: 'sabr' },
  { id: 'anger',     label: 'Anger / harsh words',        attr: 'sabr' },
  { id: 'lied',      label: 'Lied or exaggerated',        attr: 'ruh' },
  { id: 'gheebah',   label: 'Backbiting (gheebah)',       attr: 'ruh' },
  { id: 'hurt',      label: 'Hurt someone',               attr: 'ruh' },
  { id: 'overate',   label: 'Ate badly on purpose',       attr: 'jasad' },
  { id: 'latenight', label: 'Stayed up for no reason',    attr: 'waqt' },
  { id: 'other',     label: 'Something else',             attr: 'sabr' },
];

export const ALL_KINDS = [...OMISSIONS, ...COMMISSIONS];
export const KIND_LABEL = Object.fromEntries(ALL_KINDS.map((k) => [k.id, k.label]));

export function isOmission(id) {
  return OMISSIONS.some((o) => o.id === id);
}

/**
 * Record an entry. Returns the XP granted (always positive, never negative).
 * `correction` is the if–then you will actually run next time.
 */
export function logEntry({ kind, note = '', correction = '', severity = 2, at = Date.now() } = {}) {
  if (!kind) return 0;
  const entry = {
    id: uid('lg'),
    at,
    day: dayKey(new Date(at)),   // rollover-aware: 1am still belongs to yesterday
    kind,
    type: isOmission(kind) ? 'omission' : 'commission',
    note,
    correction,
    severity: Math.max(1, Math.min(3, severity)),
    resolved: false,
  };
  mutate((s) => {
    s.ledger.entries.push(entry);
    if (s.ledger.entries.length > 2000) s.ledger.entries = s.ledger.entries.slice(-2000);
  });
  // Honesty is the behaviour being reinforced. It costs you nothing to be true.
  grantXp(LEDGER_XP, ALL_KINDS.find((k) => k.id === kind)?.attr || 'sabr');
  return LEDGER_XP;
}

export function removeEntry(id) {
  mutate((s) => { s.ledger.entries = s.ledger.entries.filter((e) => e.id !== id); });
}

/** Mark that you actually ran the correction. This is the part that matters. */
export function resolveEntry(id) {
  let changed = false;
  mutate((s) => {
    const e = s.ledger.entries.find((x) => x.id === id);
    if (!e || e.resolved) return false;   // already done — do not pay twice
    e.resolved = true;
    e.resolvedAt = Date.now();
    changed = true;
  });
  if (!changed) return 0;
  grantXp(20, 'sabr');
  return 20;
}

export function entriesFor(day, state = getState()) {
  return state.ledger.entries.filter((e) => e.day === day);
}

export function recentEntries(n = 30, state = getState()) {
  return state.ledger.entries.slice(-n).reverse();
}

/**
 * What the ledger is actually for: the shape of the problem.
 * Ranked recurring types, the hours they cluster in, and how the last 7 days
 * compare with the 7 before — direction of travel, not a verdict.
 */
export function ledgerPatterns(state = getState()) {
  const entries = state.ledger.entries;
  const counts = {};
  const hours = new Array(24).fill(0);
  for (const e of entries) {
    counts[e.kind] = (counts[e.kind] || 0) + 1;
    hours[new Date(e.at).getHours()] += 1;
  }

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, label: KIND_LABEL[id] || id, count: n, omission: isOmission(id) }));

  const last7 = new Set(lastNDays(7));
  const prev7 = new Set(lastNDays(14).slice(0, 7));
  const thisWeek = entries.filter((e) => last7.has(e.day)).length;
  const lastWeek = entries.filter((e) => prev7.has(e.day)).length;

  const unresolved = entries.filter((e) => e.correction && !e.resolved).length;

  return {
    total: entries.length,
    top,
    hours,
    thisWeek,
    lastWeek,
    delta: thisWeek - lastWeek,
    unresolved,
    cleanDaysThisWeek: lastNDays(7).filter((d) => !entries.some((e) => e.day === d)).length,
  };
}

/** Days in the last n with no entries at all — shown as the positive counter. */
export function clearDays(n = 30, state = getState()) {
  const logged = new Set(state.ledger.entries.map((e) => e.day));
  return lastNDays(n).filter((d) => d <= todayKey() && !logged.has(d)).length;
}
