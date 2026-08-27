// game.js — the RPG layer: XP, levels, attributes, ranks.
// Deliberately generous and never punitive: you gain XP for showing up, for
// logging honestly, and for surviving urges. Nothing in this file ever
// subtracts XP. Loss framing is what turns one bad day into a bad month.

import { mutate, getState } from './store.js';
import { ATTRS, ATTR_ORDER, CATEGORY_ATTR, XP } from './schema.js';

/** XP required to go from `level` to `level + 1`. Gently superlinear. */
/**
 * XP to get from `level` to the next one.
 *
 * Was `40 + 25 * level`, which made the whole ladder collapse: a committed day
 * is worth 150-ish XP and a maximal one over 300, so every module in the app
 * unlocked inside the first week and level 24 arrived in three weeks. A reward
 * that arrives before you have done the thing it is meant to be rewarding is
 * not a reward, it is decoration.
 *
 * The slope is steeper and, more importantly, it grows: each level costs 90 XP
 * more than the one before, so cumulative cost is quadratic while daily earning
 * is roughly flat. That is what makes the late levels a matter of months rather
 * than of one heroic weekend.
 *
 * The first two are deliberately discounted. The opening level-up teaches what
 * levelling IS, and it has to land in the first day or two or it teaches
 * nothing. Everything after that is paced against a committed day:
 *
 *   L2   90 XP     about a day          L10   4,530    about a month
 *   L5   1,030     about a week         L24   26,300   about six months
 *   L6   1,550     about ten days       L46   96,150   about two years
 */
export function xpToNext(level) {
  if (level === 1) return 90;
  if (level === 2) return 170;
  return 70 + 90 * level;
}

/** Total XP required to have reached `level`. */
export function xpAtLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** Turn a raw XP number into level + progress into that level. */
export function levelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  let guard = 0;
  while (remaining >= xpToNext(level) && guard++ < 500) {
    remaining -= xpToNext(level);
    level += 1;
  }
  const need = xpToNext(level);
  return { level, into: remaining, need, pct: Math.min(1, remaining / need) };
}

export const RANKS = [
  { from: 1,  name: 'Mubtadi',   meaning: 'the one who has begun' },
  { from: 5,  name: 'Saalik',    meaning: 'the traveller on the path' },
  { from: 10, name: 'Mujtahid',  meaning: 'the one who exerts effort' },
  { from: 16, name: 'Muraabit',  meaning: 'the one who holds his post' },
  { from: 24, name: 'Saabir',    meaning: 'the steadfast' },
  { from: 34, name: 'Mustaqim',  meaning: 'the upright, unwavering' },
  { from: 46, name: 'Muhsin',    meaning: 'the one who acts with excellence' },
];

export function rankFor(level) {
  let r = RANKS[0];
  for (const cand of RANKS) if (level >= cand.from) r = cand;
  return r;
}

/* ------------------------------------------------------------ the ceiling */

/**
 * Levels are capped at the next rank until you ascend through it.
 *
 * Monster Hunter's model, and Genshin's: you can grind all the experience you
 * like, but the rank only moves when you clear the urgent quest. Two things
 * make it work rather than merely frustrate — the wall is always visible from
 * a long way off, and nothing is wasted while you sit under it. XP keeps
 * banking, so passing the gate releases several levels at once, which is a far
 * better moment than the same levels arriving one at a time.
 *
 * Kept here, as a pure function of a stored number, on purpose: the checks that
 * decide whether you may ascend need streaks, trials and habit ages, and
 * importing any of those into this file would close a cycle. core/ascend.js
 * owns the requirements; this file only owns the ceiling they lift.
 */
export function levelCapFor(rank = 0) {
  const next = RANKS[rank + 1];
  return next ? next.from - 1 : Infinity;
}

/** The level you are actually playing at — XP, held down by the rank gate. */
export function playerLevel(state) {
  const raw = levelFromXp(state.game.xp);
  const cap = levelCapFor(state.game.rank || 0);
  if (raw.level <= cap) return { ...raw, capped: false, cap, banked: 0 };
  // Everything above the ceiling is banked rather than lost, and reported so
  // the ladder can show exactly what is waiting on the other side of the gate.
  return {
    level: cap,
    into: xpToNext(cap),
    need: xpToNext(cap),
    pct: 1,
    capped: true,
    cap,
    banked: state.game.xp - xpAtLevel(cap + 1),
    wouldBe: raw.level,
  };
}

/** Attributes level slower than the account level — they are the long game. */
export function attrLevelFromXp(xp) {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 45)) + 1);
  const floor = 45 * (level - 1) ** 2;
  const ceil = 45 * level ** 2;
  return { level, into: xp - floor, need: ceil - floor, pct: Math.min(1, (xp - floor) / (ceil - floor)) };
}

export function attrForCategory(category) {
  return CATEGORY_ATTR[category] || 'aql';
}

/**
 * The single XP entry point. Every feature calls this and nothing else.
 * Returns {gained, level, leveledUp, attr}.
 */
export function grantXp(amount, attrId = null, { silent = false } = {}) {
  const gained = Math.max(0, Math.round(amount));
  if (!gained) return { gained: 0, leveledUp: false };
  let outcome = { gained, leveledUp: false, attr: attrId };
  mutate((s) => {
    const cap = levelCapFor(s.game.rank || 0);
    const before = Math.min(levelFromXp(s.game.xp).level, cap);
    s.game.xp += gained;
    if (attrId && attrId in s.game.attrXp) s.game.attrXp[attrId] += gained;
    const after = Math.min(levelFromXp(s.game.xp).level, cap);
    outcome.level = after;
    if (after > before) {
      outcome.leveledUp = true;
      outcome.newLevel = after;
      s.game.lastLevel = after;
    }
  }, { silent });
  if (outcome.leveledUp && !silent) {
    document.dispatchEvent(new CustomEvent('sabr:levelup', { detail: outcome }));
  }
  return outcome;
}

/** Streak combo. Long consistency multiplies the reward — Lally et al. found
 *  repetition in a stable context is what automates a habit, so repetition pays. */
export function comboMultiplier(streak) {
  if (streak >= 66) return 2.0;   // 66 days = median time to automaticity
  if (streak >= 30) return 1.6;
  if (streak >= 14) return 1.4;
  if (streak >= 7)  return 1.25;
  if (streak >= 3)  return 1.1;
  return 1;
}

export function totalAttrLevel(state = getState()) {
  return ATTR_ORDER.reduce((sum, id) => sum + attrLevelFromXp(state.game.attrXp[id] || 0).level, 0);
}

export function attrSummary(state = getState()) {
  return ATTR_ORDER.map((id) => ({
    ...ATTRS[id],
    xp: state.game.attrXp[id] || 0,
    ...attrLevelFromXp(state.game.attrXp[id] || 0),
  }));
}

export { XP };
