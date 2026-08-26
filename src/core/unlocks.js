// unlocks.js (core) — the same wallet rule, applied to the whole app.
//
// core/economy.js made habits cost XP. This makes every optional module cost
// XP too, on identical terms: a level makes it available, a price holds it
// while it is on, and turning it off refunds the price in full.
//
// So there is exactly one progression to understand. You earn XP by showing up;
// XP raises your level; the level opens habit slots and puts new modules on the
// shelf; and your balance decides how much of all that you can actually run at
// once. Habits and features compete for the same pool on purpose — that is the
// app taking its own advice about attention rather than only giving it.
//
// See data/unlocks.js for the registry and for the list of things that are
// permanently free and are never allowed in it.

import { getState, mutate } from './store.js';
import { levelFromXp } from './game.js';
import { wallet, investedUnlocks } from './economy.js';
import { UNLOCKS, UNLOCK_ORDER } from '../data/unlocks.js';

export { UNLOCKS, UNLOCK_ORDER };
// Defined in economy.js so this module can depend on that one and not the
// reverse; re-exported here so unlock callers have a single import to reach for.
export { investedUnlocks };

/* ------------------------------------------------------------- ownership */

function ownedList(state) {
  return Array.isArray(state.game.owned) ? state.game.owned : [];
}

/**
 * The receipt for one unlock, or null.
 *
 * The price paid is stored on the receipt rather than looked up in the registry
 * at refund time, so a later price change can never refund more or less than
 * was actually charged.
 */
export function receipt(id, state = getState()) {
  return ownedList(state).find((e) => e && e.id === id) || null;
}

export function isOwned(id, state = getState()) {
  return !!receipt(id, state);
}

/* ---------------------------------------------------------------- status */

/**
 * Everything the UI needs to render one row, in one call.
 * `phase` is the only field a screen should branch on.
 */
export function unlockStatus(id, state = getState()) {
  const def = UNLOCKS[id];
  if (!def) return { id, phase: 'missing' };

  const rec = receipt(id, state);
  const level = levelFromXp(state.game.xp).level;
  const balance = wallet(state).balance;
  const levelOk = level >= def.level;

  let phase = 'buyable';
  if (rec) phase = 'owned';
  else if (!levelOk) phase = 'locked';
  else if (balance < def.cost) phase = 'broke';

  return {
    id,
    def,
    phase,
    owned: !!rec,
    paid: rec ? rec.cost : 0,
    free: !!rec && rec.cost === 0,
    cost: def.cost,
    level,
    opensAt: def.level,
    levelsAway: Math.max(0, def.level - level),
    short: Math.max(0, def.cost - balance),
    balance,
  };
}

export function allUnlockStatuses(state = getState()) {
  return UNLOCK_ORDER.map((id) => unlockStatus(id, state));
}

/** Which modules become buyable on reaching `level` — for the level-up card. */
export function opensAtLevel(level) {
  return UNLOCK_ORDER.filter((id) => UNLOCKS[id].level === level).map((id) => UNLOCKS[id]);
}

/** The next thing to work toward, or null once everything is owned. */
export function nextUnlock(state = getState()) {
  const all = allUnlockStatuses(state);
  return all.find((s) => s.phase === 'buyable')
    || all.find((s) => s.phase === 'broke')
    || all.find((s) => s.phase === 'locked')
    || null;
}

/* ---------------------------------------------------------- transactions */

/**
 * Buy one. Returns {ok, reason} and never throws, because every call site is a
 * button and a button that explains itself beats a button that breaks.
 */
export function buyUnlock(id) {
  const st = unlockStatus(id);
  if (st.phase === 'missing') return { ok: false, reason: 'missing' };
  if (st.owned) return { ok: false, reason: 'owned' };
  if (st.phase === 'locked') return { ok: false, reason: 'level', opensAt: st.opensAt };
  if (st.phase === 'broke') return { ok: false, reason: 'balance', short: st.short };

  mutate((s) => {
    if (!Array.isArray(s.game.owned)) s.game.owned = [];
    s.game.owned.push({ id, cost: st.cost, at: Date.now() });
  });
  return { ok: true, cost: st.cost, def: st.def };
}

/**
 * Turn one off and take the XP back.
 *
 * Nothing is deleted. Courses, focus sessions, journal entries and the voice
 * clip all stay exactly where they are, so buying it again a month later
 * restores the module rather than starting it over. That matters: a refund you
 * are afraid to take is not a refund, and the whole point of making these
 * refundable is that trying a module has to be a reversible decision.
 */
export function sellUnlock(id) {
  const rec = receipt(id);
  if (!rec) return { ok: false, reason: 'not-owned' };

  mutate((s) => {
    s.game.owned = ownedList(s).filter((e) => e.id !== id);
    // A module that has its own on/off flag elsewhere has to agree with the
    // wallet, or the app would keep acting on data for something you turned off.
    if (id === 'uni') s.academics.enabled = false;
    if (id === 'stake') s.stake.enabled = false;
  });
  return { ok: true, refund: rec.cost, def: UNLOCKS[id] };
}

/**
 * Refund anything that used to have a price and no longer does.
 *
 * A module can be moved out of the registry and made free permanently (the way
 * University was), and when that happens the receipt is still sitting in
 * `game.owned` quietly holding XP for something nobody is charged for any more.
 * This sweeps those up on boot, so a price that is withdrawn is withdrawn for
 * people who already paid it and not only for new arrivals.
 */
export function refundRetired() {
  let freed = 0;
  mutate((s) => {
    const kept = ownedList(s).filter((e) => {
      if (UNLOCKS[e.id]) return true;
      freed += Number(e.cost) || 0;
      return false;
    });
    if (kept.length === ownedList(s).length) return false;
    s.game.owned = kept;
  }, { silent: true });
  return freed;
}

/* ----------------------------------------------------------- adoption */

/** Signs a module was already in use before it had a price. */
const IN_USE = {
  sidequests: (s) => Object.keys(s.game.quests || {}).some((k) => k.startsWith('s_')),
  focus: (s) => (s.focus.sessions || []).length > 0,
  night: (s) => Object.values(s.journal || {}).some((d) => d && (d.shutdown || d.win || d.lesson)),
  stake: (s) => !!(s.stake?.enabled || s.stake?.owed || s.stake?.settled),
  voice: (s) => !!s.profile?.hasVoice,
};

/**
 * Grandfather anything already in use, once, for free.
 *
 * Prices arriving in an update must never take a working feature away from
 * someone mid-streak. Adopted modules are recorded at cost 0, so they hold no
 * capacity and refund nothing — you keep what you were already using and the
 * budget you already had, and only genuinely new modules cost anything.
 */
export function adoptExisting() {
  mutate((s) => {
    if (s.game.adopted) return false;
    if (!Array.isArray(s.game.owned)) s.game.owned = [];
    const have = new Set(s.game.owned.map((e) => e.id));
    for (const id of UNLOCK_ORDER) {
      if (have.has(id)) continue;
      let used = false;
      try { used = !!IN_USE[id]?.(s); } catch (_) { used = false; }
      if (used) s.game.owned.push({ id, cost: 0, at: Date.now(), adopted: true });
    }
    s.game.adopted = true;
  }, { silent: true });
}
