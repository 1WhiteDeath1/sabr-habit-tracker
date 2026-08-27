// ascend.js — the wall between ranks, and what it takes to get through.
//
// Borrowed, deliberately, from the games that solved this already:
//
//   Monster Hunter gates Hunter Rank behind an Urgent Quest. You may grind as
//   much as you like; the rank does not move until you clear the specific
//   thing. That is the whole idea here.
//
//   Genshin banks the overflow. Experience earned against a capped rank is not
//   thrown away, so clearing the gate releases several levels at once. One big
//   moment beats the same levels dribbling out individually.
//
//   Old School RuneScape gates content behind quest points rather than combat
//   level, which is why its ladder feels like a record of things you did rather
//   than of hours you spent. Every requirement below is a thing you did.
//
// The requirements are chosen so that a person using this app normally will
// meet them without aiming at them — the gate is a checkpoint, not a boss. It
// is still a wall, and that is the point: a level that arrives purely because
// time passed is not an achievement, and the app has plenty of those already.

import { getState, mutate } from './store.js';
import { RANKS, levelFromXp, levelCapFor, playerLevel } from './game.js';
import { bestRun } from './streak.js';
import { trialRecord } from './trials.js';
import { ageInDays } from './habits.js';

/**
 * What each rank costs beyond the XP.
 *
 * Two or three requirements each, drawn from different systems on purpose: a
 * gate you can satisfy entirely with one habit is a gate that rewards a narrow
 * player, and the ranks are supposed to mean you are running the whole app.
 */
export const ASCENSIONS = [
  {
    rank: 1, level: 5, name: 'Saalik', meaning: 'the traveller on the path',
    blurb: 'You have started. This proves you can hold it for a week.',
    reqs: [
      { id: 'streak', n: 7, label: 'A 7-day run' },
      { id: 'chains', n: 1, label: 'One quest tier claimed' },
    ],
  },
  {
    rank: 2, level: 10, name: 'Mujtahid', meaning: 'the one who exerts effort',
    blurb: 'Effort, not intention. A trial finished is the difference.',
    reqs: [
      { id: 'streak', n: 21, label: 'A 21-day run' },
      { id: 'trials', n: 1, label: 'One trial won' },
    ],
  },
  {
    rank: 3, level: 16, name: 'Muraabit', meaning: 'the one who holds his post',
    blurb: 'Holding a post means being there on the days it is dull.',
    reqs: [
      { id: 'streak', n: 30, label: 'A 30-day run' },
      { id: 'chains', n: 3, label: 'Three quest tiers claimed' },
      { id: 'trials', n: 2, label: 'Two trials won' },
    ],
  },
  {
    rank: 4, level: 24, name: 'Saabir', meaning: 'the steadfast',
    blurb: 'Sixty-six days is where a habit stops being a decision.',
    reqs: [
      { id: 'streak', n: 66, label: 'A 66-day run' },
      { id: 'automatic', n: 1, label: 'One habit past 66 days' },
    ],
  },
  {
    rank: 5, level: 34, name: 'Mustaqim', meaning: 'the upright, unwavering',
    blurb: 'Not one habit carrying you. Several, held at once.',
    reqs: [
      { id: 'streak', n: 100, label: 'A 100-day run' },
      { id: 'automatic', n: 3, label: 'Three habits past 66 days' },
      { id: 'trials', n: 5, label: 'Five trials won' },
    ],
  },
  {
    rank: 6, level: 46, name: 'Muhsin', meaning: 'the one who acts with excellence',
    blurb: 'Half a year unbroken. There is nothing above this one.',
    reqs: [
      { id: 'streak', n: 180, label: 'A 180-day run' },
      { id: 'automatic', n: 5, label: 'Five habits past 66 days' },
      { id: 'trials', n: 10, label: 'Ten trials won' },
    ],
  },
];

/** Where a requirement's number actually comes from. */
function measure(req, state) {
  switch (req.id) {
    case 'streak':
      return bestRun(state);
    case 'trials':
      return trialRecord(state).won;
    case 'chains':
      return Object.values(state.game.quests || {}).filter((q) => q && q.completedAt).length;
    case 'automatic':
      return state.habits.filter((hab) => !hab.archived && ageInDays(hab, state) >= 66).length;
    case 'perfect':
      return Number(state.game.perfectDays || 0);
    default:
      return 0;
  }
}

export function currentRank(state = getState()) {
  return Math.min(RANKS.length - 1, Number(state.game.rank || 0));
}

/**
 * The gate directly ahead, with every requirement measured.
 *
 * Returns null only at the top of the ladder. `xpReady` and `reqsReady` are
 * kept apart so the screen can say which half you are waiting on — being told
 * "not yet" without being told which half is the most annoying thing a gate
 * can do.
 */
export function nextGate(state = getState()) {
  const rank = currentRank(state);
  const gate = ASCENSIONS.find((a) => a.rank === rank + 1);
  if (!gate) return null;

  const raw = levelFromXp(state.game.xp);
  const reqs = gate.reqs.map((r) => {
    const have = measure(r, state);
    return { ...r, have, met: have >= r.n, pct: Math.min(1, have / r.n) };
  });

  return {
    ...gate,
    reqs,
    xpReady: raw.level >= gate.level,
    xpHave: raw.level,
    reqsReady: reqs.every((r) => r.met),
    ready: raw.level >= gate.level && reqs.every((r) => r.met),
    done: reqs.filter((r) => r.met).length,
  };
}

export function canAscend(state = getState()) {
  return !!nextGate(state)?.ready;
}

/**
 * Break through.
 *
 * Grants no XP of its own — the reward is the banked XP being released, which
 * is a larger and better-earned jump than anything this function could hand
 * out, and it keeps the ladder honest: ranks are proof of what you did, never
 * a source of the numbers that prove it.
 */
export function ascend() {
  const state = getState();
  const gate = nextGate(state);
  if (!gate || !gate.ready) return null;

  const before = playerLevel(state);
  mutate((s) => {
    s.game.rank = gate.rank;
    if (!Array.isArray(s.game.ascensions)) s.game.ascensions = [];
    s.game.ascensions.push({ rank: gate.rank, at: Date.now() });
  });
  const after = playerLevel(getState());
  return { gate, from: before.level, to: after.level, gained: after.level - before.level };
}

/**
 * The ladder, as rows to draw.
 *
 * Every level from 1 to the top, tagged with the rank it belongs to and
 * whether it is behind, current, capped or unreached. The screen renders a
 * window onto this rather than all 46 at once.
 */
export function ladder(state = getState()) {
  const lv = playerLevel(state);
  const rank = currentRank(state);
  const cap = levelCapFor(rank);

  return RANKS.map((r, i) => {
    const from = r.from;
    const to = RANKS[i + 1] ? RANKS[i + 1].from - 1 : 60;
    const gate = ASCENSIONS.find((a) => a.rank === i);
    return {
      ...r,
      index: i,
      from,
      to,
      gate,
      held: i <= rank,
      current: i === rank,
      atCap: i === rank && lv.capped,
      levels: to - from + 1,
      // How far through this band you are, for the bar on the row.
      pct: i < rank ? 1 : i > rank ? 0
        : Math.min(1, Math.max(0, (lv.level - from + (lv.capped ? 1 : lv.pct)) / (to - from + 1))),
    };
  });
}

export { playerLevel, levelCapFor };
