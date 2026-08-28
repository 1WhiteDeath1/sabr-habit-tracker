// trials.js — the one place in this app you are allowed to fail.
//
// Habits deliberately cannot be failed. Miss a day and the app shrinks the ask,
// spends a rukhsah, offers the two-minute version — every mechanism points at
// keeping you in. That is right for habits and it is why nothing else here
// carries stakes: a game where you cannot lose is a game where winning means
// nothing either.
//
// A trial is the exception, and it is safe to be one for a single reason: you
// accept it. Nothing is imposed, one runs at a time, stepping away is free and
// is not recorded as a loss, and the worst outcome is a smaller reward rather
// than a penalty. That keeps the stakes real without handing the app a way to
// make you feel worse than you already do.
//
// Three tiers, because one length fits nobody:
//
//   LIGHT     three days, small reward. The on-ramp, and the thing to take in
//             a bad week when a seven-day commitment would just be a way to
//             fail at something new on top of everything else.
//   STANDARD  seven days. The default shape.
//   HARD      a fortnight, and only offered once you have won the seven-day
//             version of the same thing. You do not get to attempt the long
//             one until the short one is behind you, which means a hard trial
//             is never the first thing you try and fail.
//
// Every metric is windowed to the trial's own days. A trial you can satisfy
// with work you did last month is not a trial.

export const TIERS = {
  light:    { id: 'light',    label: 'Light',    days: 3,  metal: 'bronze' },
  standard: { id: 'standard', label: 'Standard', days: 7,  metal: 'silver' },
  hard:     { id: 'hard',     label: 'Hard',     days: 14, metal: 'gold' },
};
export const TIER_ORDER = ['light', 'standard', 'hard'];

/** Kept for the default window where a trial does not name its own. */
export const TRIAL_DAYS = 7;

/**
 * Rewards scale with both length and how much a trial asks of you inside it.
 * A fortnight is roughly two and a half times a week rather than twice, because
 * the second week of anything is the one that actually costs something.
 */
export const TRIALS = [
  /* ------------------------------------------------------------- light */
  {
    id: 'kept3', tier: 'light',
    title: 'Three Days Kept',
    desc: 'Keep three days in a row. One habit a day, any size.',
    metric: 'keptDays', target: 3, xp: 110, attr: 'sabr',
    note: 'The lowest bar in the app, held three times without a gap. Start here if you are starting.',
  },
  {
    id: 'dawn3', tier: 'light',
    title: 'Three Dawns',
    desc: 'Fajr on time, three days running.',
    metric: 'habitDays', args: { match: 'fajr' }, target: 3, xp: 140, attr: 'ruh',
    note: 'Three is where it stops being an accident.',
  },
  {
    id: 'recite3', tier: 'light',
    title: 'Three With It',
    desc: 'Qur’an on three days.',
    metric: 'habitDays', args: { match: 'quran' }, target: 3, xp: 120, attr: 'ruh',
    note: 'A page counts. The line matters more than the length.',
  },
  {
    id: 'move3', tier: 'light',
    title: 'Three Days Moving',
    desc: 'Move your body on three days.',
    metric: 'habitDays', args: { match: 'move' }, target: 3, xp: 120, attr: 'jasad',
    note: 'Short enough that weather and excuses do not get a chance.',
  },
  {
    id: 'desk3', tier: 'light',
    title: 'Three Sittings',
    desc: 'Study on three days.',
    metric: 'studyDays', target: 3, xp: 130, attr: 'aql', needs: 'academics',
    note: 'Fifteen minutes counts as a day.',
  },

  /* ---------------------------------------------------------- standard */
  {
    id: 'dawn', tier: 'standard',
    title: 'Seven Dawns',
    desc: 'Fajr on time, every day for a week.',
    metric: 'habitDays', args: { match: 'fajr' }, target: 7, xp: 420, attr: 'ruh',
    note: 'The hardest recurring decision most people face. Seven in a row changes what you think you are.',
  },
  {
    id: 'unbroken', tier: 'standard',
    title: 'Unbroken',
    desc: 'Keep every one of the next seven days.',
    metric: 'keptDays', target: 7, xp: 380, attr: 'sabr',
    note: 'One habit a day, at any size, seven days running.',
  },
  {
    id: 'complete', tier: 'standard',
    title: 'A Full Week',
    desc: 'Finish everything due, on five of seven days.',
    metric: 'perfectDays', target: 5, xp: 460, attr: 'sabr',
    note: 'Not seven. Five, because a trial that needs a perfect week is a trial you decline.',
  },
  {
    id: 'recite', tier: 'standard',
    title: 'Never Away From It',
    desc: 'Qur’an every day for a week.',
    metric: 'habitDays', args: { match: 'quran' }, target: 7, xp: 400, attr: 'ruh',
    note: 'A page counts. The point is the unbroken line, not the volume.',
  },
  {
    id: 'moved', tier: 'standard',
    title: 'Seven Days Moving',
    desc: 'Move your body on six of the next seven days.',
    metric: 'habitDays', args: { match: 'move' }, target: 6, xp: 360, attr: 'jasad',
    note: 'Six of seven. The rest day is built in rather than stolen.',
  },
  {
    id: 'desk', tier: 'standard',
    title: 'Hours At The Desk',
    desc: 'Study on five days this week.',
    metric: 'studyDays', target: 5, xp: 400, attr: 'aql', needs: 'academics',
    note: 'Fifteen minutes counts as a day. Five of them is a working week.',
  },
  {
    id: 'present', tier: 'standard',
    title: 'Every Class',
    desc: 'Attend ten classes without an absence.',
    metric: 'classesAttended', target: 10, xp: 380, attr: 'aql', needs: 'academics',
    note: 'The cheapest marks in a degree, and the ones most often thrown away.',
  },
  {
    id: 'deep', tier: 'standard',
    title: 'Deep Work',
    desc: 'Five focus blocks in seven days.',
    metric: 'focusSessions', target: 5, xp: 360, attr: 'aql', needs: 'focus',
    note: 'Finished blocks only. An abandoned one does not count, which is the whole test.',
  },
  {
    id: 'clean', tier: 'standard',
    title: 'Seven Clean',
    desc: 'Seven clean days, one after another.',
    metric: 'cleanDays', target: 7, xp: 480, attr: 'sabr', needs: 'recovery',
    note: 'If it breaks, the trial ends and nothing else does. Your record and your streak are untouched.',
  },

  /* -------------------------------------------------------------- hard */
  {
    id: 'dawn14', tier: 'hard', requires: 'dawn',
    title: 'Fourteen Dawns',
    desc: 'Fajr on time, every day for a fortnight.',
    metric: 'habitDays', args: { match: 'fajr' }, target: 14, xp: 1000, attr: 'ruh',
    note: 'You have already held this for a week. The second week is the one that changes the default.',
  },
  {
    id: 'unbroken14', tier: 'hard', requires: 'unbroken',
    title: 'A Fortnight Unbroken',
    desc: 'Keep every day for fourteen days.',
    metric: 'keptDays', target: 14, xp: 900, attr: 'sabr',
    note: 'Fourteen days with no gap. Every rukhsah you hold still covers you underneath.',
  },
  {
    id: 'recite14', tier: 'hard', requires: 'recite',
    title: 'A Fortnight With It',
    desc: 'Qur’an every day for fourteen days.',
    metric: 'habitDays', args: { match: 'quran' }, target: 14, xp: 950, attr: 'ruh',
    note: 'Two weeks unbroken is the point at which reaching for it stops being a decision.',
  },
  {
    id: 'desk14', tier: 'hard', requires: 'desk',
    title: 'A Fortnight At The Desk',
    desc: 'Study on ten days out of fourteen.',
    metric: 'studyDays', target: 10, xp: 950, attr: 'aql', needs: 'academics',
    note: 'Ten of fourteen. Two full working weeks with four days of slack in them.',
  },
  {
    id: 'clean14', tier: 'hard', requires: 'clean',
    title: 'Fourteen Clean',
    desc: 'Fourteen clean days, one after another.',
    metric: 'cleanDays', target: 14, xp: 1100, attr: 'sabr', needs: 'recovery',
    note: 'Twice what you have already done once. Nothing about your record changes if it breaks.',
  },
];

export const TRIAL_BY_ID = Object.fromEntries(TRIALS.map((t) => [t.id, t]));

/** How long a given trial runs, from its tier. */
export function daysOf(spec) {
  return TIERS[spec?.tier]?.days ?? TRIAL_DAYS;
}
