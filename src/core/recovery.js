// recovery.js — the engine behind the Shield section.
//
// Design rules, and every one of them is deliberate:
//   1. Lifetime clean days NEVER decrease. A relapse ends a streak; it does not
//      erase a year of work. Counting only the current streak is what produces
//      the "abstinence violation effect" (Marlatt & Gordon) — the shame spiral
//      where one lapse becomes a full relapse because progress felt worthless.
//   2. Logging a lapse EARNS XP. If honesty costs you, you stop being honest,
//      and a tracker you lie to is worse than no tracker.
//   3. An urge is framed as an external encounter to outlast, not a moral
//      failure to feel guilty about. This is urge surfing (Bowen & Marlatt).

import { getState, mutate } from './store.js';
import { grantXp, XP } from './game.js';
import { uid } from './schema.js';
import { todayKey, dayKey, daysBetween } from './dates.js';

/** Milliseconds clean in the current streak. */
export function cleanMs(state = getState()) {
  const since = state.recovery.cleanSince;
  if (!since) return 0;
  return Math.max(0, Date.now() - new Date(since).getTime());
}

export function cleanDays(state = getState()) {
  return Math.floor(cleanMs(state) / 86400000);
}

/** Everything the Shield header needs, in one call. */
export function recoveryStats(state = getState()) {
  const r = state.recovery;
  const ms = cleanMs(state);
  const days = Math.floor(ms / 86400000);
  const urgesSurvived = r.urges.filter((u) => u.survived).length;
  const totalUrges = r.urges.length;
  return {
    ms,
    days,
    best: Math.max(r.bestStreakDays || 0, days),
    lifetime: (r.lifetimeCleanDays || 0) + days,
    episodes: r.episodes.length,
    urgesSurvived,
    totalUrges,
    winRate: totalUrges ? urgesSurvived / totalUrges : null,
    since: r.cleanSince,
    daysSinceLastEpisode: r.episodes.length
      ? daysBetween(dayKey(new Date(r.episodes[r.episodes.length - 1].at)), todayKey())
      : null,
  };
}

/** Turn the module on and start the first clean streak. */
export function startRecovery(at = new Date()) {
  mutate((s) => {
    s.recovery.enabled = true;
    s.recovery.cleanSince = at.toISOString();
    if (!s.recovery.firstStarted) s.recovery.firstStarted = at.toISOString();
  });
}

/**
 * Record a relapse and start a fresh streak. Banks the days already earned into
 * the lifetime total first, so nothing is ever lost.
 */
export function logEpisode({ triggers = [], mood = null, note = '', lessonPlan = '' } = {}) {
  const earned = cleanDays();
  mutate((s) => {
    const r = s.recovery;
    r.bestStreakDays = Math.max(r.bestStreakDays || 0, earned);
    r.lifetimeCleanDays = (r.lifetimeCleanDays || 0) + earned;
    r.episodes.push({ id: uid('ep'), at: Date.now(), triggers, mood, note, lessonPlan, streakEnded: earned });
    r.cleanSince = new Date().toISOString();
    if (!r.firstStarted) r.firstStarted = r.cleanSince;
    r.enabled = true;
  });
  // Honesty is the behaviour we want to reinforce, so it pays.
  grantXp(XP.urgeLogged, 'sabr');
  return earned;
}

/** Record an urge encounter — survived or not. Called at the end of an SOS session. */
export function logUrge({ intensity = 3, durationSec = 0, survived = true, triggers = [], where = '', note = '' } = {}) {
  mutate((s) => {
    s.recovery.urges.push({
      id: uid('u'), at: Date.now(), intensity, durationSec, survived, triggers, where, note,
    });
    if (s.recovery.urges.length > 500) s.recovery.urges = s.recovery.urges.slice(-500);
  });
  grantXp(survived ? XP.urgeSurvived : XP.urgeLogged, 'sabr');
}

/** Award the daily clean-day XP once per day, on first open. */
export function creditCleanDay() {
  const key = todayKey();
  const s = getState();
  if (!s.recovery.enabled || !s.recovery.cleanSince) return false;
  if (s.recovery.lastCredited === key) return false;
  mutate((st) => { st.recovery.lastCredited = key; }, { silent: true });
  grantXp(XP.cleanDay, 'sabr', { silent: true });
  return true;
}

/* ------------------------------------------------ if/then plans (WOOP) */

/**
 * Implementation intentions: "If <trigger>, then I will <action>."
 * Gollwitzer's meta-analysis (1999, 2006) puts the effect at roughly d = 0.65
 * on goal attainment — one of the largest reliable effects in the literature.
 * They work because the plan hands control to the situation instead of to
 * willpower, which is exactly what fails during an urge.
 */
export function addPlan(trigger, thenDo) {
  const plan = { id: uid('p'), trigger, thenDo, createdAt: Date.now(), usedCount: 0 };
  mutate((s) => { s.recovery.plans.push(plan); });
  return plan;
}

export function removePlan(id) {
  mutate((s) => { s.recovery.plans = s.recovery.plans.filter((p) => p.id !== id); });
}

export function markPlanUsed(id) {
  mutate((s) => {
    const p = s.recovery.plans.find((x) => x.id === id);
    if (p) p.usedCount = (p.usedCount || 0) + 1;
  });
}

/* ------------------------------------------------------ pattern analysis */

export const TRIGGERS = [
  { id: 'bored',    label: 'Bored',              halt: null },
  { id: 'tired',    label: 'Tired',              halt: 'T' },
  { id: 'lonely',   label: 'Lonely',             halt: 'L' },
  { id: 'stressed', label: 'Stressed / anxious', halt: 'A' },
  { id: 'angry',    label: 'Angry / frustrated', halt: 'A' },
  { id: 'hungry',   label: 'Hungry',             halt: 'H' },
  { id: 'scrolling',label: 'Scrolling / feed',   halt: null },
  { id: 'alone',    label: 'Alone in my room',   halt: null },
  { id: 'latenight',label: 'Late at night',      halt: null },
  { id: 'inbed',    label: 'Phone in bed',       halt: null },
  { id: 'sad',      label: 'Low / empty',        halt: 'L' },
  { id: 'reward',   label: 'Felt I "deserved" it', halt: null },
];

export const TRIGGER_LABEL = Object.fromEntries(TRIGGERS.map((t) => [t.id, t.label]));

/**
 * What actually precedes your urges and lapses. Returns ranked triggers and the
 * hours of day where risk concentrates. This is the part that makes the log
 * worth keeping — self-monitoring only helps when it feeds back (Harkin et al.
 * 2016 meta-analysis: monitoring improves goal attainment, and more so when the
 * results are made visible).
 */
export function patterns(state = getState()) {
  const r = state.recovery;
  const events = [
    ...r.urges.map((u) => ({ at: u.at, triggers: u.triggers || [], bad: !u.survived, weight: 1 })),
    ...r.episodes.map((e) => ({ at: e.at, triggers: e.triggers || [], bad: true, weight: 2 })),
  ];

  const triggerCount = {};
  const hourCount = new Array(24).fill(0);
  for (const e of events) {
    for (const t of e.triggers) triggerCount[t] = (triggerCount[t] || 0) + e.weight;
    hourCount[new Date(e.at).getHours()] += e.weight;
  }

  const topTriggers = Object.entries(triggerCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, n]) => ({ id, label: TRIGGER_LABEL[id] || id, count: n }));

  // Collapse to 3-hour bands so a handful of events still shows a shape.
  const bands = [];
  for (let h = 0; h < 24; h += 3) {
    bands.push({ from: h, to: h + 3, count: hourCount.slice(h, h + 3).reduce((a, b) => a + b, 0) });
  }
  bands.sort((a, b) => b.count - a.count);

  return {
    sampleSize: events.length,
    topTriggers,
    riskiestBand: bands[0]?.count ? bands[0] : null,
    hourCount,
  };
}

/* ------------------------------------------------------------ environment */

/**
 * Friction beats willpower. Wood & Neal (2007) showed habits are cued by
 * context far more than by intention, so changing the context is the highest
 * leverage move available — and it is a one-time cost, not a daily fight.
 */
export const GUARDS = [
  { id: 'nobedroom',  label: 'Phone charges outside the bedroom overnight' },
  { id: 'filter',     label: 'DNS or content filter installed on the phone' },
  { id: 'nobathroom', label: 'No phone in the bathroom' },
  { id: 'grayscale',  label: 'Grayscale mode on after Isha' },
  { id: 'feeds',      label: 'Feeds / suggested-content apps removed or logged out' },
  { id: 'password',   label: 'Filter password held by someone else' },
  { id: 'incognito',  label: 'Private browsing disabled' },
  { id: 'accountable',label: 'One person knows I am working on this' },
];

export function setGuard(id, on) {
  mutate((s) => { s.recovery.guards[id] = !!on; });
}

export function guardScore(state = getState()) {
  const on = GUARDS.filter((g) => state.recovery.guards[g.id]).length;
  return { on, total: GUARDS.length, pct: on / GUARDS.length };
}
