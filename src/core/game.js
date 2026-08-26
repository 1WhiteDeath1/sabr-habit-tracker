// game.js — the RPG layer: XP, levels, attributes, ranks.
// Deliberately generous and never punitive: you gain XP for showing up, for
// logging honestly, and for surviving urges. Nothing in this file ever
// subtracts XP. Loss framing is what turns one bad day into a bad month.

import { mutate, getState } from './store.js';
import { ATTRS, ATTR_ORDER, CATEGORY_ATTR, XP } from './schema.js';

/** XP required to go from `level` to `level + 1`. Gently superlinear. */
export function xpToNext(level) {
  return 40 + 25 * level;
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
    const before = levelFromXp(s.game.xp).level;
    s.game.xp += gained;
    if (attrId && attrId in s.game.attrXp) s.game.attrXp[attrId] += gained;
    const after = levelFromXp(s.game.xp).level;
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
