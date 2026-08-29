// unlocks.js (data) — everything in this app that has to be earned.
//
// Pure data, zero imports, so core/economy.js and core/unlocks.js can both read
// it without an import cycle.
//
// ---------------------------------------------------------------------------
// The one rule the whole economy runs on
//
//   XP you have earned is CAPACITY, not currency.
//   Anything you are running holds some of it.
//   Nothing is ever burned — turn it off and you get every point back.
//
// That rule was already true of habits (core/economy.js) and this file extends
// it to the rest of the app, so there is one number to understand instead of a
// habit budget over here and a feature list over there.
//
// The consequence is the interesting part. Switching on the focus timer, the
// night ritual and university tracking costs the same capacity a couple of
// habits would. The app has argued since its first screen that a small set held
// well beats a wide set held badly; with this, the app is no longer only saying
// that about habits, it is saying it about *itself* and paying the price for
// its own surface area.
//
// ---------------------------------------------------------------------------
// What is deliberately NOT in this file
//
// Nothing that helps in a crisis, nothing that tells you the truth about
// yourself, and nothing a beginner needs on day one. So: Today, habits, the
// main quest line, Shield, the SOS screen, urge logging, the honesty ledger,
// the return protocol, prayer times and every analytic are free, permanently,
// and are never listed here. Charging someone XP to reach the panic button
// would be the single worst thing this app could do.
//
// ---------------------------------------------------------------------------
// Pricing
//
// Levels arrive at 65 / 155 / 270 / 410 / 575 / 765 / 980 / 1220 lifetime XP,
// and capacity is lifetime XP + the 160 opening budget. Each price is set at
// roughly a third of the capacity you have when its level opens, so unlocking
// something is always a real trade against a habit or two and never a formality
// you tap through. `level` is when it becomes *visible as buyable*; the price
// is what it then holds.

export const UNLOCKS = {
  sidequests: {
    id: 'sidequests',
    label: 'Side quests',
    tag: 'Quests',
    icon: 'map',
    level: 2,
    cost: 30,
    // The board lives on Today, not Quests. This still said '#/quests' after
    // the move, which sent anyone who bought it to a screen it is not on.
    href: '#/today',
    blurb: 'Three optional missions a day, rerolled every morning.',
    why: 'Small, self-contained wins on days when the habits themselves feel like too much. Ignoring one has never cost anything and never will.',
    // What the screen says when this is off, in place of the feature.
    teaser: 'A daily board of small optional missions.',
  },

  focus: {
    id: 'focus',
    label: 'The focus timer',
    tag: 'Deep work',
    icon: 'timer',
    level: 3,
    cost: 60,
    href: '#/focus',
    blurb: 'A two-minute start button, a timer that survives the app closing.',
    why: 'Built on the premise that you do not have a discipline problem, you have a starting problem. If you never actually sit down to work, this is the highest-value thing here; if you do, it is surface area you do not need.',
    teaser: 'A timer built around starting, not finishing.',
  },

  night: {
    id: 'night',
    label: 'The night ritual',
    tag: 'Shutdown',
    icon: 'moon',
    level: 4,
    cost: 90,
    href: '#/night',
    blurb: 'A closing ceremony for the day: checklist, journal, tomorrow decided.',
    why: 'Almost every ruined morning was decided the night before. A day with no explicit ending bleeds into the next one.',
    teaser: 'A shutdown routine that ends the day on purpose.',
  },

  stake: {
    id: 'stake',
    label: 'The stake',
    tag: 'Commitment',
    icon: 'flame',
    level: 6,
    cost: 140,
    href: '#/habits',
    blurb: 'A consequence you set while calm, charged for fully missed days.',
    why: 'The best-evidenced mechanic in this app — forfeit-on-failure accounts raised smoking quit rates by about a third in a randomised trial, and the effect outlasted the account. Priced high because it only works if you meant it.',
    teaser: 'Name a consequence for a day where nothing got done.',
  },

  voice: {
    id: 'voice',
    label: 'A message to yourself',
    tag: 'SOS',
    icon: 'lamp',
    level: 9,
    cost: 220,
    href: '#/me/settings',
    blurb: 'Record thirty seconds of yourself, played back on the SOS screen.',
    why: 'Written text gets read in your own flat internal narrator — the voice already losing the argument. A recording arrives with the conviction you had when you made it. Late in the order because it needs a calm day and something to say.',
    teaser: 'Your own voice, played back at the worst moment.',
  },
};

export const UNLOCK_ORDER = ['sidequests', 'focus', 'night', 'stake', 'voice'];

/**
 * Never for sale, and listed in the Vault so the boundary is visible.
 *
 * `href` where there is a screen to go to. The list was eight dead lines saying
 * a free thing exists; a free thing you cannot reach from the place that names
 * it is a claim rather than a feature, and Reps in particular had exactly one
 * way in, buried on Today.
 */
export const ALWAYS_FREE = [
  { label: 'Today, and every habit you hold', icon: 'check', href: '#/today' },
  { label: 'Shield, the SOS screen and urge logging', icon: 'shield', href: '#/shield' },
  // University sat on the shelf at level 7 for exactly one revision. It was the
  // wrong call: attendance is a deadline you cannot renegotiate, and a student
  // who needs the 80% line watched needs it in week one, not at level 7. It
  // earns XP now instead of costing it — see UNI_XP in core/academics.js.
  { label: 'University: attendance, deadlines and GPA', icon: 'cap', href: '#/uni' },
  // Same reasoning as University: a body that has not moved in a year needs
  // the wall push-up in week one, not at level 5. It earns XP rather than
  // costing it — see TRAIN_XP in core/training.js.
  { label: 'Reps: the movement ladders and every record on them', icon: 'jasad', href: '#/reps' },
  { label: 'The honesty ledger', icon: 'ledger', href: '#/ledger' },
  { label: 'The main quest line', icon: 'trophy', href: '#/quests' },
  { label: 'Every record, streak and analytic', icon: 'chart', href: '#/me/records' },
  { label: 'The return protocol, after days away', icon: 'sprout' },
];
