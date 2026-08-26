// stake.js — a consequence you chose while thinking clearly.
//
// This is the best-evidenced mechanic in the app. Giné, Karlan and Zinman's
// CARES trial gave smokers a savings account they forfeited if they failed a
// test at six months; quit rates rose about three percentage points off a low
// base — roughly a third more quitters — and the effect was still measurable at
// twelve months, after the account was gone. Commitment devices beat reminders
// by a wide margin, and the reason is structural: a reminder competes with how
// you feel, and a stake does not care how you feel.
//
// Two rules keep this from becoming a punishment engine:
//
//   You set it, and you can lower or cancel it whenever you like. A stake you
//   cannot escape is a trap, and it would make lying to the tracker rational.
//
//   Nothing is ever taken automatically. The app records what you owe and you
//   settle it in the world. It cannot and should not move money.
//
// The natural currency here is sadaqah, which is why the default is money to be
// given rather than money to be lost. That difference matters: the failure
// still produces something good, so the mechanism has no shame in it.

import { getState, mutate } from './store.js';
import { todayKey, addDays, daysBetween } from './dates.js';
import { isDue, statusOf } from './habits.js';
import { STATUS } from './schema.js';

/** What a missed day can cost. Chosen so the smallest is not a token. */
export const STAKE_KINDS = {
  sadaqah: {
    id: 'sadaqah', label: 'Sadaqah', unit: 'currency',
    verb: 'give', blurb: 'A fixed amount given away for each day you miss.',
  },
  rakat: {
    id: 'rakat', label: 'Extra prayer', unit: 'rakats',
    verb: 'pray', blurb: 'Extra nafl rakats owed for each day you miss.',
  },
  custom: {
    id: 'custom', label: 'Something else', unit: '',
    verb: 'do', blurb: 'Anything you will actually follow through on.',
  },
};

export function makeStake(patch = {}) {
  return {
    enabled: false,
    kind: 'sadaqah',
    amount: 2,
    unitLabel: '',          // e.g. "£" or "rakats"; free text so any currency works
    habitId: null,          // null = any missed habit counts
    owed: 0,                // accrued, not yet settled
    settled: 0,             // lifetime settled — this one only goes up
    lastCountedDay: null,   // so a day can never be charged twice
    startedAt: null,
    ...patch,
  };
}

/** A short human description, used in several places. */
export function describeStake(stake) {
  if (!stake?.enabled) return '';
  const kind = STAKE_KINDS[stake.kind] || STAKE_KINDS.custom;
  const unit = stake.unitLabel || kind.unit;
  const amount = kind.id === 'sadaqah' ? `${unit}${stake.amount}` : `${stake.amount} ${unit}`.trim();
  return `${amount} per missed day`;
}

/**
 * Days that were fully missed since the stake last counted, capped so that
 * coming back after a long absence does not present a bill big enough to make
 * you close the app. Two weeks is already a number worth looking at.
 */
const MAX_CATCHUP_DAYS = 14;

function missedOn(state, key, habitId) {
  const habits = state.habits.filter((h) => !h.archived && (!habitId || h.id === habitId));
  const due = habits.filter((h) => isDue(h, key));
  if (!due.length) return false;
  // A day counts as missed only when nothing due was done — a partial day is a
  // day you showed up, and charging for it would punish the two-minute version.
  return due.every((h) => {
    const st = statusOf(state, key, h.id);
    return st !== STATUS.DONE && st !== STATUS.PARTIAL && st !== STATUS.SKIP;
  });
}

/**
 * Bring the ledger up to date. Only ever counts days that are fully over, so
 * today is never charged while you can still fix it.
 */
export function accrue(state = getState(), key = todayKey()) {
  const stake = state.stake;
  if (!stake?.enabled) return { added: 0, days: [] };

  const from = stake.lastCountedDay
    ? addDays(stake.lastCountedDay, 1)
    : addDays(key, -1);

  const span = Math.min(MAX_CATCHUP_DAYS, Math.max(0, daysBetween(from, key)));
  const days = [];
  for (let i = 0; i < span; i++) {
    const day = addDays(from, i);
    if (day >= key) break;                       // today is still open
    if (missedOn(state, day, stake.habitId)) days.push(day);
  }

  if (!days.length && span === 0) return { added: 0, days: [] };

  const added = days.length * stake.amount;
  mutate((s) => {
    s.stake.owed += added;
    s.stake.lastCountedDay = addDays(key, -1);
  }, { silent: true });
  return { added, days };
}

/** Mark what you owe as settled. Nothing verifies this but you. */
export function settle(amount = null) {
  mutate((s) => {
    const pay = amount == null ? s.stake.owed : Math.min(amount, s.stake.owed);
    s.stake.owed = Math.max(0, s.stake.owed - pay);
    s.stake.settled += pay;
  });
}

export function startStake(patch) {
  mutate((s) => {
    s.stake = makeStake({ ...s.stake, ...patch, enabled: true, startedAt: Date.now(), lastCountedDay: null });
  });
}

export function stopStake() {
  // Stopping keeps whatever is owed: cancelling the rule does not cancel the
  // days you already missed under it.
  mutate((s) => { s.stake.enabled = false; });
}
