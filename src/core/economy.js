// economy.js — habits cost XP to take on.
//
// The idea: a habit has a difficulty, difficulty has a price, and you start
// with a small budget. You cannot open with five hard habits because you cannot
// afford five hard habits. The constraint the app has been *advising* since the
// first version — start with two or three, start small — becomes something the
// game actually enforces, and choosing becomes interesting rather than free.
//
// One design problem had to be solved first.
//
// XP already drives the level, the level unlocks habit slots, and game.js says
// in its own header that nothing may ever subtract XP, because loss framing is
// what turns one bad day into a bad month. If buying a habit deducted XP you
// could buy one, drop a level, and lose the slot the habit needs to sit in.
//
// So there are two ledgers rather than one:
//
//   game.xp      lifetime earned. Drives the level. Still only ever goes up.
//   game.spent   currently committed to active habits.
//   balance      xp - spent, which is what you may spend now.
//
// And archiving a habit refunds its cost in full. XP is therefore a budget you
// commit, not money you burn: you can always undo a choice, the level never
// moves, and the non-punitive rule survives intact.

import { getState, mutate } from './store.js';
import { playerLevel } from './game.js';

/**
 * Five tiers. The prices are superlinear on purpose — a severe habit costs more
 * than three easy ones, so the game keeps pushing you toward a small set held
 * well rather than a wide set held badly.
 */
/**
 * The five ranks a habit can hold.
 *
 * Named for metals because a metal ladder is understood before it is read —
 * nobody has to be told that diamond outranks bronze, which is the whole point
 * of using one. `metal` drives the colour theming in the gallery; `label` is
 * only ever shown next to the blurb, which is what actually says how hard the
 * habit is.
 *
 * Two gates, not one. `minLevel` is whether the habit has appeared in your
 * library at all; `cost` is whether you can afford it now that it has. A game
 * gallery works precisely because those are separate — being able to see the
 * thing you cannot yet have is most of what makes the ladder legible, and it
 * does the teaching that a paragraph of explanation was doing badly.
 *
 * The gates are front-loaded so the first two ranks are open immediately: a new
 * player has to be able to build a real day on day one, and a library that
 * opens mostly locked reads as a paywall rather than as a map.
 */
export const DIFFICULTY = {
  1: { id: 1, label: 'Bronze',   metal: 'bronze',   emoji: '\u{1F949}', cost: 20,  minLevel: 1,
       blurb: 'A minute or two. Hard to have an excuse.' },
  2: { id: 2, label: 'Silver',   metal: 'silver',   emoji: '\u{1F948}', cost: 45,  minLevel: 1,
       blurb: 'Small, but you have to remember it.' },
  3: { id: 3, label: 'Gold',     metal: 'gold',     emoji: '\u{1F947}', cost: 90,  minLevel: 2,
       blurb: 'A real slice of the day.' },
  4: { id: 4, label: 'Platinum', metal: 'platinum', emoji: '\u{1F4A0}', cost: 160, minLevel: 5,
       blurb: 'Needs the day arranged around it.' },
  5: { id: 5, label: 'Diamond',  metal: 'diamond',  emoji: '\u{1F48E}', cost: 260, minLevel: 9,
       blurb: 'The kind most people quit. Take one at a time.' },
};

/** Is this rank open at this level yet? */
/**
 * What holding a habit of each rank pays per day.
 *
 * These were flat: every habit paid XP.habitFull regardless of rank, so a
 * Diamond that cost 260 to buy returned exactly what a 20 XP Bronze did. That
 * made the rank on the row a decoration and made buying anything difficult
 * strictly the worse deal.
 *
 * The spread is deliberately much flatter than the price spread — thirteen
 * times the cost, three times the return. Enough that difficulty is worth
 * something, not enough to make a day of small habits feel like a wasted one.
 * The app's whole argument is that a small set held well beats a big set held
 * badly, and an economy that paid proportionally would be arguing the opposite.
 */
export const TIER_PAY = { 1: 10, 2: 14, 3: 18, 4: 24, 5: 30 };

/** Full, two-minute and partial payouts for a rank, keeping the old ratios. */
export function payoutFor(tier) {
  const full = TIER_PAY[tier] ?? TIER_PAY[2];
  return { full, tiny: Math.round(full * 0.43), partial: Math.round(full * 0.57) };
}

export function tierOpenAt(tier, level) {
  return level >= (DIFFICULTY[tier]?.minLevel ?? 1);
}

/** The rank a given level has just opened, if any — for the level-up card. */
export function tierOpenedAt(level) {
  return DIFFICULTY_ORDER.map((t) => DIFFICULTY[t]).find((d) => d.minLevel === level) || null;
}

export const DIFFICULTY_ORDER = [1, 2, 3, 4, 5];

/**
 * The opening budget.
 *
 * Chosen so the first choice is a genuine trade-off rather than a formality:
 * 160 buys three Easy with change, or Moderate plus Light plus Easy, or exactly
 * one Hard and nothing else. Committing everything to one difficult habit is a
 * legitimate opening, and the number is picked so the game says so.
 */
export const STARTING_XP = 160;

/** A habit's tier, defaulting to Light for anything created before this existed. */
export function difficultyOf(habit) {
  const d = Math.round(habit?.difficulty);
  return DIFFICULTY[d] ? d : 2;
}

/** What this habit costs to hold. */
export function costOf(habit) {
  return DIFFICULTY[difficultyOf(habit)].cost;
}

/** What the live habits hold. */
export function investedHabits(state = getState()) {
  return state.habits.filter((x) => !x.archived).reduce((n, h) => n + costOf(h), 0);
}

/**
 * What the unlocked modules hold.
 *
 * Summed from the receipts in `game.owned` rather than looked up in the unlock
 * registry, which keeps this file free of any import from core/unlocks.js — that
 * module needs `wallet()` from here, and one of the two directions had to give.
 * It also means a price change can never retroactively alter what an already
 * bought module is holding. See data/unlocks.js.
 */
export function investedUnlocks(state = getState()) {
  const owned = Array.isArray(state.game.owned) ? state.game.owned : [];
  return owned.reduce((n, e) => n + (Number(e?.cost) || 0), 0);
}

/**
 * Everything currently committed, derived rather than trusted.
 *
 * Habits and modules draw on the same pool deliberately. Switching on the focus
 * timer costs what a habit costs, so the app pays for its own surface area
 * instead of only advising you about yours.
 */
export function invested(state = getState()) {
  return investedHabits(state) + investedUnlocks(state);
}

/**
 * The wallet.
 *
 * `spent` is recomputed from the live habits rather than read from the stored
 * counter, so an import, a migration or a hand-edited backup can never leave
 * the balance lying about what is actually committed.
 */
export function wallet(state = getState()) {
  const earned = state.game.xp + STARTING_XP;
  const committed = invested(state);
  return {
    earned,
    committed,
    onHabits: investedHabits(state),
    onUnlocks: investedUnlocks(state),
    balance: Math.max(0, earned - committed),
    level: playerLevel(state).level,
  };
}

export function canAfford(habitOrDifficulty, state = getState()) {
  const cost = typeof habitOrDifficulty === 'number'
    ? (DIFFICULTY[habitOrDifficulty]?.cost ?? 0)
    : costOf(habitOrDifficulty);
  return wallet(state).balance >= cost;
}

/** The cheapest tier still within budget, for "what can I actually take?" */
export function affordableTiers(state = getState()) {
  const b = wallet(state).balance;
  return DIFFICULTY_ORDER.filter((d) => DIFFICULTY[d].cost <= b);
}

/**
 * Keep the stored counter in step with reality.
 *
 * Nothing reads `game.spent` for decisions — `invested()` is the truth — but it
 * is worth storing so the number survives in an export and can be shown without
 * a full recount. It covers habits *and* unlocked modules, matching `invested()`.
 */
export function syncSpent() {
  mutate((s) => {
    const total = investedHabits(s) + investedUnlocks(s);
    if (s.game.spent === total) return false;
    s.game.spent = total;
  }, { silent: true });
}

/** Everything the UI needs to explain the price of one habit. */
export function priceTag(habit, state = getState()) {
  const d = difficultyOf(habit);
  const tier = DIFFICULTY[d];
  const w = wallet(state);
  return {
    difficulty: d,
    label: tier.label,
    blurb: tier.blurb,
    cost: tier.cost,
    affordable: w.balance >= tier.cost,
    short: Math.max(0, tier.cost - w.balance),
    balance: w.balance,
  };
}
