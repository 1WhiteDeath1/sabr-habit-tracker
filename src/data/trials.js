// trials.js — the one place in this app you are allowed to fail.
//
// Habits deliberately cannot be failed. Miss a day and the app shrinks the ask,
// spends a rukhsah, offers the two-minute version — every mechanism points at
// keeping you in. That is right for habits and it is why nothing here carries
// any stakes: a game where you cannot lose is a game where winning means
// nothing either.
//
// A trial is the exception, and it is safe to be one for a single reason: you
// have to accept it. Nothing is ever imposed, one runs at a time, and the worst
// outcome is a smaller reward rather than a penalty. That keeps the stakes real
// without handing the app a way to make you feel worse than you already do.
//
// Every metric here is windowed to the trial's own seven days. A trial you can
// satisfy with work you did last month is not a trial.

export const TRIAL_DAYS = 7;

/**
 * Rewards are large next to a habit tick (14) and next to a milestone (250) —
 * a week of deliberate effort should move the level bar visibly, or accepting
 * one is a worse deal than simply carrying on.
 */
export const TRIALS = [
  {
    id: 'dawn',
    title: 'Seven Dawns',
    desc: 'Fajr on time, every day for a week.',
    metric: 'habitDays', args: { match: 'fajr' },
    target: 7, xp: 420, attr: 'ruh',
    note: 'The hardest recurring decision most people face. Seven in a row changes what you think you are.',
  },
  {
    id: 'unbroken',
    title: 'Unbroken',
    desc: 'Keep every one of the next seven days.',
    metric: 'keptDays',
    target: 7, xp: 380, attr: 'sabr',
    note: 'One habit a day, at any size, seven days running. The lowest bar there is, held without a gap.',
  },
  {
    id: 'complete',
    title: 'A Full Week',
    desc: 'Finish everything due, on five of seven days.',
    metric: 'perfectDays',
    target: 5, xp: 460, attr: 'sabr',
    note: 'Not seven. Five, because a trial that needs a perfect week is a trial you decline.',
  },
  {
    id: 'recite',
    title: 'Never Away From It',
    desc: 'Qur’an every day for a week.',
    metric: 'habitDays', args: { match: 'quran' },
    target: 7, xp: 400, attr: 'ruh',
    note: 'A page counts. The point is the unbroken line, not the volume.',
  },
  {
    id: 'moved',
    title: 'Seven Days Moving',
    desc: 'Move your body on six of the next seven days.',
    metric: 'habitDays', args: { match: 'move' },
    target: 6, xp: 360, attr: 'jasad',
    note: 'Six of seven. The rest day is built in rather than stolen.',
  },
  {
    id: 'desk',
    title: 'Hours At The Desk',
    desc: 'Study on five days this week.',
    metric: 'studyDays',
    target: 5, xp: 400, attr: 'aql',
    needs: 'academics',
    note: 'Fifteen minutes counts as a day. Five of them is a working week.',
  },
  {
    id: 'present',
    title: 'Every Class',
    desc: 'Attend ten classes without an absence.',
    metric: 'classesAttended',
    target: 10, xp: 380, attr: 'aql',
    needs: 'academics',
    note: 'The cheapest marks in a degree, and the ones most often thrown away.',
  },
  {
    id: 'deep',
    title: 'Deep Work',
    desc: 'Five focus blocks in seven days.',
    metric: 'focusSessions',
    target: 5, xp: 360, attr: 'aql',
    needs: 'focus',
    note: 'Finished blocks only. An abandoned one does not count, which is the whole test.',
  },
  {
    id: 'clean',
    title: 'Seven Clean',
    desc: 'Seven clean days, one after another.',
    metric: 'cleanDays',
    target: 7, xp: 480, attr: 'sabr',
    needs: 'recovery',
    note: 'If it breaks, the trial ends and nothing else does. Your record and your streak are untouched.',
  },
];

export const TRIAL_BY_ID = Object.fromEntries(TRIALS.map((t) => [t.id, t]));
