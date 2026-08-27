// quests.js (engine) — evaluates every quest goal against your real logs.
//
// Nothing here is hand-tracked. Progress is derived, so it cannot desync, and
// deleting the app's quest record would not lose a single day of progress.
//
// One deliberate choice: main-quest day goals count CUMULATIVE days, not
// consecutive ones. A missed Tuesday should not delete five weeks. This also
// happens to match the research it is named after — Lally et al. (2010) tracked
// repetitions of a behaviour, and found occasional missed days did not
// meaningfully affect the automaticity curve.

import { getState, mutate } from './store.js';
import { STATUS } from './schema.js';
import { grantXp } from './game.js';
import { todayKey } from './dates.js';
import { MAIN_QUESTS, SIDE_QUESTS, SIDE_BY_ID, QUEST_BY_ID, CHAIN_META, SIDE_THEME_ORDER } from '../data/quests.js';
import { cleanDays } from './recovery.js';
import { STUDY_MIN_DAY } from './academics.js';

const DONE_STATES = new Set([STATUS.DONE, STATUS.PARTIAL]);

/* --------------------------------------------------------- goal evaluation */

function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z]/g, '');
}

/** Distinct days where at least one habit matching `pred` was completed. */
function daysMatching(state, pred) {
  const habitIds = new Set(state.habits.filter(pred).map((h) => h.id));
  if (!habitIds.size) return 0;
  let count = 0;
  for (const key of Object.keys(state.logs)) {
    const day = state.logs[key];
    for (const id of Object.keys(day)) {
      if (habitIds.has(id) && DONE_STATES.has(day[id].status)) { count += 1; break; }
    }
  }
  return count;
}

/** Raw progress value for a goal. Returns a number. */
export function goalValue(goal, state = getState()) {
  switch (goal.type) {
    case 'categoryDays':
      return daysMatching(state, (h) => h.category === goal.category);
    case 'prayerAnchorDays':
      return daysMatching(state, (h) => h.anchorPrayer === goal.prayer);
    case 'habitTitleDays':
      return daysMatching(state, (h) => normalize(h.title).includes(goal.match)
        || normalize(h.tiny).includes(goal.match));
    case 'cleanDays':
      return cleanDays(state);
    case 'urgesSurvived':
      return state.recovery.urges.filter((u) => u.survived).length;
    case 'focusSessions':
      return state.focus.sessions.filter((s) => s.completed).length;
    case 'focusMinutes':
      return Math.round(state.focus.sessions.filter((s) => s.completed)
        .reduce((sum, s) => sum + (s.minutes || 0), 0));
    case 'shutdowns':
      return Object.values(state.journal).filter((j) => j && j.shutdown).length;
    case 'reviews':
      return state.reviews.length;
    case 'guardsAndPlans':
      return Object.values(state.recovery.guards).filter(Boolean).length + state.recovery.plans.length;
    case 'classesAttended':
      return Object.values(state.academics.attendance)
        .reduce((n, book) => n + Object.values(book).filter((v) => v === 'present').length, 0);
    case 'uniTasksDone':
      return state.academics.tasks.filter((t) => t.done).length;
    case 'studyMinutes':
      return (state.academics.study || []).reduce((sum, e) => sum + (e.minutes || 0), 0);
    case 'studyDays': {
      // Distinct days with a real amount on them, not sessions — the chain is
      // about turning up at the desk repeatedly, not about long single sittings.
      const perDay = {};
      for (const e of state.academics.study || []) {
        perDay[e.day] = (perDay[e.day] || 0) + (e.minutes || 0);
      }
      return Object.values(perDay).filter((m) => m >= STUDY_MIN_DAY).length;
    }
    case 'perfectDays':
      return Number(state.game.perfectDays || 0);
    default:
      console.warn('[quests] unknown goal type', goal.type);
      return 0;
  }
}

export function progressOf(quest, state = getState()) {
  const value = goalValue(quest.goal, state);
  const target = quest.goal.target;
  return { value: Math.min(value, target), raw: value, target, pct: Math.min(1, value / target), met: value >= target };
}

/* ------------------------------------------------------------ main quests */

function record(state, id) {
  return state.game.quests[id] || null;
}

export function isComplete(id, state = getState()) {
  return !!record(state, id)?.completedAt;
}

/** Is this quest unlocked — i.e. is its prerequisite tier already claimed? */
export function isUnlocked(quest, state = getState()) {
  if (quest.requiresRecovery && !state.recovery.enabled) return false;
  if (quest.requiresAcademics && !state.academics.enabled) return false;
  if (!quest.requires) return true;
  return isComplete(quest.requires, state);
}

/**
 * The active board: for every chain, the lowest unclaimed tier that is
 * unlocked. Completed chains report their final tier as `done`.
 */
export function mainBoard(state = getState()) {
  const byChain = new Map();
  for (const q of MAIN_QUESTS) {
    if (!byChain.has(q.chain)) byChain.set(q.chain, []);
    byChain.get(q.chain).push(q);
  }
  const out = [];
  for (const [chain, tiers] of byChain) {
    const next = tiers.find((q) => !isComplete(q.id, state));
    const meta = CHAIN_META[chain];
    if (!next) {
      const last = tiers[tiers.length - 1];
      out.push({ chain, meta, quest: last, done: true, locked: false, progress: progressOf(last, state) });
      continue;
    }
    const locked = !isUnlocked(next, state);
    out.push({ chain, meta, quest: next, done: false, locked, progress: progressOf(next, state) });
  }
  // Claimable first, then in-progress by how close they are, then locked.
  out.sort((a, b) => {
    const rank = (x) => (x.done ? 3 : x.locked ? 2 : x.progress.met ? 0 : 1);
    return rank(a) - rank(b) || b.progress.pct - a.progress.pct;
  });
  return out;
}

/** Claim a finished main quest. Returns the XP granted, or 0 if not claimable. */
export function claimMain(id) {
  const state = getState();
  const quest = QUEST_BY_ID[id];
  if (!quest || quest.kind !== 'main') return 0;
  if (isComplete(id, state) || !isUnlocked(quest, state)) return 0;
  if (!progressOf(quest, state).met) return 0;

  // Claiming a tier of the chain you named pays a premium. Without it the
  // pursuit is a label rather than a decision, and a decision with no
  // consequence is not one.
  const bonus = isPursued(quest.chain, state) ? Math.round(quest.xp * PURSUIT_BONUS) : 0;
  mutate((s) => {
    s.game.quests[id] = { ...(s.game.quests[id] || {}), completedAt: Date.now() };
  });
  grantXp(quest.xp + bonus, quest.attr);
  document.dispatchEvent(new CustomEvent('sabr:quest-complete', { detail: { quest, bonus } }));
  return quest.xp + bonus;
}

/* --------------------------------------------------------------- pursuit */

/**
 * The one chain you are actively pushing on.
 *
 * Goal shielding: Shah, Friedman and Kruglanski showed that committing to a
 * single goal actively inhibits competing ones, and that the effect is stronger
 * the more committed you are. Fourteen chains presented as equals is the
 * failure mode that finding describes — so the board now asks you to name one,
 * and pays a premium on it to make naming it a real decision rather than a
 * label.
 */
export const PURSUIT_BONUS = 0.5;

export function pursuit(state = getState()) {
  const p = state.game.pursuit;
  if (!p || !p.chain) return null;
  const next = mainBoard(state).find((row) => row.quest.chain === p.chain);
  if (!next) return null;
  return { ...p, ...next };
}

export function setPursuit(chain) {
  mutate((s) => { s.game.pursuit = chain ? { chain, since: Date.now() } : null; });
  return chain;
}

export function isPursued(chain, state = getState()) {
  return state.game.pursuit?.chain === chain;
}

/* ------------------------------------------------------------ side quests */

/** Small deterministic PRNG so a day's offers stay stable across reloads. */
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eligibleSideQuests(state) {
  return SIDE_QUESTS.filter((q) => {
    if ((q.id === 's_wave' || q.id === 's_fast') && !state.recovery.enabled) return false;
    return true;
  });
}

/**
 * Today's three offers. Rolled once per day and then frozen, so the board does
 * not reshuffle under your thumb. Yesterday's untaken offers simply vanish —
 * there is no penalty and no backlog, which is the whole point of side quests.
 *
 * The three are drawn from three DIFFERENT themes, so a day never offers you
 * three variations on the same thing and never leaves a whole side of your life
 * unrepresented.
 */
export function todaysOffers(state = getState()) {
  const key = todayKey();
  if (state.game.offers.day === key && state.game.offers.sideQuestIds.length) {
    return state.game.offers.sideQuestIds.map((id) => SIDE_BY_ID[id]).filter(Boolean);
  }
  const pool = eligibleSideQuests(state);
  const rand = mulberry32(seedFrom(key));

  // Shuffle the theme order for the day, then take one quest from each of the
  // first three themes that still have anything in the pool.
  const themes = shuffle(SIDE_THEME_ORDER.filter((t) => pool.some((q) => q.attr === t)), rand);
  const picked = [];
  for (const theme of themes) {
    if (picked.length >= 3) break;
    const inTheme = pool.filter((q) => q.attr === theme);
    picked.push(inTheme[Math.floor(rand() * inTheme.length)]);
  }
  // If fewer than three themes exist, top up from anywhere.
  let guard = 0;
  while (picked.length < 3 && guard++ < 200) {
    const q = pool[Math.floor(rand() * pool.length)];
    if (q && !picked.some((p) => p.id === q.id)) picked.push(q);
  }

  mutate((s) => { s.game.offers = { day: key, sideQuestIds: picked.map((q) => q.id) }; }, { silent: true });
  return picked;
}

/** Fisher-Yates using the day's seeded PRNG, so the order is stable per day. */
function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sideStatus(id, state = getState()) {
  const rec = record(state, id);
  const key = todayKey();
  if (rec?.completedOn === key) return 'done';
  if (rec?.acceptedOn === key) return 'accepted';
  return 'open';
}

export function acceptSide(id) {
  mutate((s) => {
    s.game.quests[id] = { ...(s.game.quests[id] || {}), acceptedOn: todayKey() };
  });
}

export function completeSide(id) {
  const state = getState();
  if (sideStatus(id, state) === 'done') return 0;
  const quest = SIDE_BY_ID[id];
  if (!quest) return 0;
  mutate((s) => {
    const prev = s.game.quests[id] || {};
    s.game.quests[id] = {
      ...prev,
      acceptedOn: prev.acceptedOn || todayKey(),
      completedOn: todayKey(),
      timesCompleted: (prev.timesCompleted || 0) + 1,
    };
  });
  grantXp(40, quest.attr);
  document.dispatchEvent(new CustomEvent('sabr:quest-complete', { detail: { quest: { ...quest, kind: 'side', xp: 40 } } }));
  return 40;
}

/** Anything sitting at 100% and waiting for a tap — drives the badge on the nav. */
export function claimableCount(state = getState()) {
  return mainBoard(state).filter((row) => !row.done && !row.locked && row.progress.met).length;
}

export { MAIN_QUESTS, SIDE_QUESTS, QUEST_BY_ID };
