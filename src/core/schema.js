// schema.js — the single source of truth for the shape of saved data.
// Every field the app persists is declared here with a default. If you add a
// field, add it here and bump SCHEMA_VERSION with a migration in store.js.

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'sabr.state.v1';

export const MOTIVATIONS = {
  deen:      { id: 'deen',      label: 'Accountability to Allah', icon: 'worship' },
  health:    { id: 'health',    label: 'Health & energy',          icon: 'body' },
  time:      { id: 'time',      label: 'Not wasting my life',      icon: 'hourglass' },
  discipline:{ id: 'discipline',label: 'Discipline & self-respect',icon: 'target' },
  purity:    { id: 'purity',    label: 'Purity / breaking the addiction', icon: 'shield' },
  someone:   { id: 'someone',   label: 'Becoming someone worth marrying', icon: 'hands' },
};

// Colours match the palette in ui/styles.css. A category's colour is what tints
// its habit rows, so these have to be the same values the CSS uses.
export const CATEGORIES = {
  worship:  { id: 'worship',  label: 'Worship',   color: '#58cc02', icon: 'worship' },
  body:     { id: 'body',     label: 'Body',      color: '#ff9600', icon: 'body' },
  mind:     { id: 'mind',     label: 'Mind',      color: '#1cb0f6', icon: 'mind' },
  work:     { id: 'work',     label: 'Work',      color: '#ffc800', icon: 'work' },
  purity:   { id: 'purity',   label: 'Purity',    color: '#ce82ff', icon: 'purity' },
  sleep:    { id: 'sleep',    label: 'Sleep',     color: '#00cd9c', icon: 'sleep' },
};

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_LABEL = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', sunrise: 'Sunrise',
};

/** Time-of-day buckets a habit can sit in when it is not anchored to a prayer. */
export const SLOTS = {
  morning:   { id: 'morning',   label: 'Morning',   from: 4 * 60,  to: 11 * 60 },
  midday:    { id: 'midday',    label: 'Midday',    from: 11 * 60, to: 16 * 60 },
  evening:   { id: 'evening',   label: 'Evening',   from: 16 * 60, to: 21 * 60 },
  night:     { id: 'night',     label: 'Night',     from: 21 * 60, to: 28 * 60 },
  anytime:   { id: 'anytime',   label: 'Anytime',   from: 0,       to: 24 * 60 },
};
export const SLOT_ORDER = ['morning', 'midday', 'evening', 'night', 'anytime'];

export const STATUS = { DONE: 'done', PARTIAL: 'partial', SKIP: 'skip' };

/** A habit as stored. `cadence` decides which days it is due. */
export function makeHabit(patch = {}) {
  return {
    // Shown on the row and in the gallery. Library habits bring their own;
    // a hand-written one falls back to its category icon.
    emoji: '',
    id: patch.id || uid('h'),
    title: '',
    category: 'mind',
    difficulty: 2,           // 1..5, see core/economy.js — sets what it costs to hold
    icon: 'check',          // name from ui/icons.js, not a picture
    // cadence: {type:'daily'} | {type:'weekdays', days:[1,3,5]} | {type:'times', perWeek:3}
    cadence: { type: 'daily' },
    slot: 'anytime',
    anchorPrayer: null,      // 'fajr' | ... | null
    anchorHabitId: null,     // habit stacking: do this right after that habit
    cue: '',                 // "when/where" half of the implementation intention
    tiny: '',                // the 2-minute version — the one you can never excuse
    full: '',                // the full version, when you have capacity
    why: '',                 // personal reason, shown when you are about to skip
    evidence: null,          // key into RESEARCH, shows the "why this works" card
    proof: null,             // {source:'quran'|'hadith', ...} scripture backing
    // A standing time, in minutes since midnight — every day until cleared.
    reminderAt: null,
    // A time for one day only: {day:'YYYY-MM-DD', at: minutes}. Kept separate
    // from reminderAt rather than overwriting it, so "just today" can never
    // quietly become "forever" and a one-off cannot destroy a standing time.
    todayAt: null,
    easyUntil: null,         // day key: until then the target is `tiny` — see core/comeback.js
    archived: false,
    createdAt: Date.now(),
    order: 0,
    ...patch,
  };
}

export function makeProfile(patch = {}) {
  return {
    name: '',
    birthDate: null,          // "2000-01-01" — powers the life-in-weeks view
    lifeExpectancy: 75,
    // The other two horizons on the Me screen. Both are plain day keys, both
    // optional, and neither depends on the academics module being switched on —
    // you can count down a degree without tracking a single class.
    uniStart: null,           // first day of the degree
    uniEnd: null,             // expected graduation
    marriageDate: null,       // the date you are planning around, not a promise
    motivations: [],          // keys of MOTIVATIONS
    why: '',                  // the one paragraph read back on hard days
    // A private line for the person you are trying to be ready for. Surfaced
    // at the moments it helps and nowhere else — never on a screen someone
    // could read over your shoulder in passing.
    forWhom: '',
    // Whether a voice note exists. The clip itself lives in IndexedDB, never
    // in this object — it is far too big for localStorage and must not ride
    // along in an exported backup you might email to yourself.
    hasVoice: false,
    identity: '',             // "I am the kind of person who ..."
    onboarded: false,
    tutorialDone: false,      // Noor's card tour, shown once after onboarding
    coachDone: false,         // Noor's second pass, pointing at the real controls
    ...patch,
  };
}

export function makeSettings(patch = {}) {
  return {
    theme: 'light',
    haptics: true,
    sound: true,
    arabic: true,             // show Arabic alongside translations
    notifications: false,
    wakeTarget: '05:00',
    sleepTarget: '23:00',
    // Prayer times: either computed from coordinates, or typed by hand.
    prayerMode: 'manual',     // 'manual' | 'auto'
    location: null,           // {lat, lon, label}
    calcMethod: 'karachi',
    asrMethod: 'standard',    // 'standard' (Shafi) | 'hanafi'
    manualPrayers: { fajr: '04:45', dhuhr: '12:15', asr: '15:45', maghrib: '18:40', isha: '20:05' },
    ...patch,
  };
}

export function makeAcademics(patch = {}) {
  return {
    enabled: false,
    university: 'FAST-NUCES',
    campus: '',
    program: '',
    rollNumber: '',
    semester: { name: '', startDate: null, endDate: null },
    attendanceThreshold: 0.80,   // editable — confirm yours in the handbook
    courses: [],
    attendance: {},              // courseId -> { dayKey: 'present'|'absent'|'excused'|'cancelled' }
    tasks: [],                   // [{id, courseId, title, type, due, done, xp}]
    // Self-reported work outside class: [{id, courseId, day, minutes, paid, xp}].
    // `paid` is the part that was under the daily ceiling — see UNI_XP.
    study: [],
    weekBonuses: [],             // week keys already claimed for a clean week
    history: [],                 // past semesters: [{label, gpa, credits}]
    ...patch,
  };
}

/**
 * The reps ladder — see core/training.js and data/exercises.js.
 *
 * `plan` is the round you are on: one rung per movement pattern. `log` is what
 * you actually did, one entry per day, and it is the only record — there is no
 * streak here and nothing derived from absence, because a missed day is not an
 * event this feature has an opinion about.
 */
export function makeTraining(patch = {}) {
  return {
    plan: [],            // [{mid, rung}] — ordered, one per movement
    goalRounds: 1,       // how many times through you are aiming for; never enforced
    restSec: 60,         // rest timer between sets; 0 switches it off entirely
    log: {},             // dayKey -> {sets:[{id, mid, rung, reps, unit, score, at}], paid}
    declined: [],        // "push:full" — step-ups offered and turned down, so it asks once
    startedAt: null,
    ...patch,
  };
}

export function makeLedger(patch = {}) {
  return {
    entries: [],       // [{id, at, day, kind, type, note, correction, severity, resolved}]
    ...patch,
  };
}

export function makeRecovery(patch = {}) {
  return {
    enabled: false,
    cleanSince: null,          // ISO timestamp of the start of the current streak
    firstStarted: null,        // ISO timestamp of the very first attempt
    lifetimeCleanDays: 0,      // never resets — a lapse cannot erase your total
    bestStreakDays: 0,
    episodes: [],              // [{at, triggers:[], mood, note, lessonPlan}]
    urges: [],                 // [{at, intensity, durationSec, survived, triggers:[], where}]
    plans: [],                 // [{id, trigger, thenDo}] — if/then, Gollwitzer
    guards: {},                // checklist id -> boolean
    accountability: '',        // name of the person you report to (never sent anywhere)
    ...patch,
  };
}

/** RPG attributes. Every habit category feeds exactly one attribute, so
 *  nothing you do is "untracked" and no attribute is unreachable. */
export const ATTRS = {
  ruh:   { id: 'ruh',   label: 'Ruh',   sub: 'Spirit',    icon: 'ruh',   color: '#58cc02', from: ['worship'] },
  jasad: { id: 'jasad', label: 'Jasad', sub: 'Body',      icon: 'jasad', color: '#ff9600', from: ['body'] },
  aql:   { id: 'aql',   label: 'Aql',   sub: 'Mind',      icon: 'aql',   color: '#1cb0f6', from: ['mind'] },
  sabr:  { id: 'sabr',  label: 'Sabr',  sub: 'Restraint', icon: 'sabr',  color: '#ce82ff', from: ['purity'] },
  waqt:  { id: 'waqt',  label: 'Waqt',  sub: 'Time',      icon: 'waqt',  color: '#ffc800', from: ['work', 'sleep'] },
};
export const ATTR_ORDER = ['ruh', 'jasad', 'aql', 'sabr', 'waqt'];

/** category -> attribute, derived from ATTRS.from so the two can never drift. */
export const CATEGORY_ATTR = Object.freeze(
  Object.values(ATTRS).reduce((acc, a) => {
    a.from.forEach((c) => { acc[c] = a.id; });
    return acc;
  }, {})
);

export const XP = {
  habitTiny: 6,        // showing up at all is the point — it still pays
  habitFull: 14,
  habitPartial: 8,
  focusPerMin: 0.8,
  urgeSurvived: 45,    // the single highest-value action in the app
  urgeLogged: 10,      // logging honestly is rewarded, never punished
  cleanDay: 20,
  journal: 12,
  shutdown: 15,
  weeklyReview: 60,
  questSide: 40,
  questMainStep: 120,
};

export function makeGame(patch = {}) {
  return {
    xp: 0,
    attrXp: { ruh: 0, jasad: 0, aql: 0, sabr: 0, waqt: 0 },
    quests: {},        // questId -> {accepted, progress, completedAt, offeredOn, dismissed}
    offers: { day: null, sideQuestIds: [] },  // today's rotating side-quest offers
    spent: 0,          // XP currently committed — habits + modules (see core/economy.js)
    // Receipts for bought modules: [{id, cost, at, adopted?}]. The price paid
    // lives on the receipt, not in the registry, so changing a price later can
    // never refund more or less than was actually charged. See core/unlocks.js.
    owned: [],
    adopted: false,    // whether pre-existing modules have been grandfathered in, once
    unlocked: [],      // achievement ids
    lastLevel: 1,      // used to detect a level-up and celebrate it exactly once
    seenIntro: false,

    /* ---- the day streak (core/streak.js) ---------------------------------
     * The current run is never stored: it is derived from the logs, so it can
     * never drift from them. What IS stored is only the things arithmetic
     * cannot recover — the high-water mark, which must outlive the run that
     * set it, and the concessions already spent. */
    bestDayStreak: 0,      // longest run ever; milestones vest against this
    lastStreak: 0,         // last run seen, to notice a break exactly once
    lastBreak: null,       // {at, was, on, seen} — the record of a fall
    milestonesClaimed: [], // milestone day-counts already celebrated

    /* ---- the medium horizon (core/trials.js, core/quests.js) ------------
     * The one chain you have chosen to push on, and the one trial you have
     * accepted. Both are deliberately singular: fourteen parallel goals
     * motivate about as well as none. */
    /* The rank you have ascended to. Holds the level ceiling — see
     * levelCapFor() in game.js and the gates in core/ascend.js. */
    rank: 0,
    ascensions: [],        // [{rank, at}]

    pursuit: null,         // {chain, since}
    trial: null,           // {id, from, to, acceptedAt, settled}
    trialHistory: [],      // [{id, outcome, value, target, xp, endedAt}]
    rukhsah: { covered: [] }, // day keys a concession has been spent on
    ...patch,
  };
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    profile: makeProfile(),
    settings: makeSettings(),
    habits: [],
    logs: {},          // dayKey -> { habitId: {status, at, note} }
    journal: {},       // dayKey -> {gratitude:[], win, lesson, mood, energy, shutdown}
    focus: { sessions: [], tasks: [] },
    training: makeTraining(),
    recovery: makeRecovery(),
    ledger: makeLedger(),
    academics: makeAcademics(),
    reviews: [],       // [{weekOfKey, at, kept, drop, change, note}]
    comebacks: [],     // [{day, at, away, cause, plan, eased}] — returns after 2+ days off
    stake: {           // the commitment device — see core/stake.js
      enabled: false, kind: 'sadaqah', amount: 2, unitLabel: '', habitId: null,
      owed: 0, settled: 0, lastCountedDay: null, startedAt: null,
    },
    // Dismissals last one day: the bell is a nudge, not a to-do list you can
    // clear forever while the thing it was about is still true.
    notifications: { day: null, dismissed: [] },
    game: makeGame(),
    // Was a dead field for the whole life of this app: collected on every save
    // and never read once. Superseded by game.rukhsah, which is the same idea
    // with an earning rule and a spend path — see core/streak.js.
    streakFreezes: 2,
    createdAt: Date.now(),
    lastOpened: null,
  };
}

let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
