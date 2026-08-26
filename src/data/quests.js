// quests.js (data) — every quest in the game, declared as data.
//
// A quest is never hand-tracked. Each one carries a `goal` that the engine in
// core/quests.js evaluates against your actual logs, so progress can never
// drift from reality and there is nothing to tick off twice.
//
// MAIN quests are chains: tier II only appears once tier I is done. They are
// the spine. SIDE quests are a rotating pool of three offers a day — take them
// or ignore them, nothing is lost either way. That is the point of them.

/* ------------------------------------------------------------ main chains */

const CHAINS = [
  {
    chain: 'foundation',
    title: 'The Foundation',
    attr: 'ruh',
    blurb: 'Worship, held steady, becomes the floor everything else stands on.',
    goalType: 'categoryDays',
    goalArgs: { category: 'worship' },
    tiers: [7, 21, 40, 66],
    tierNames: ['A Week Standing', 'Three Weeks Standing', 'Forty Days', 'The Sixty-Six'],
    tierNote: [
      'Seven days of at least one act of worship logged.',
      'Twenty-one days. The point where it stops feeling like a decision.',
      'Forty days. Long enough that the absence would feel wrong.',
      'Sixty-six days — the median time to automaticity in Lally et al. (2010).',
    ],
  },
  {
    chain: 'dawn',
    title: 'Break of Dawn',
    attr: 'waqt',
    blurb: 'Win the first hour and the rest of the day stops negotiating with you.',
    goalType: 'prayerAnchorDays',
    goalArgs: { prayer: 'fajr' },
    tiers: [7, 21, 40],
    tierNames: ['First Light', 'The Habit of Dawn', 'Owner of Mornings'],
    tierNote: [
      'Seven days completing something anchored to Fajr.',
      'Twenty-one days. Your wake time is now a fact, not a hope.',
      'Forty days. The morning belongs to you.',
    ],
  },
  {
    chain: 'shield',
    title: 'The Shield',
    attr: 'sabr',
    blurb: 'Distance from the thing that has been eating your self-respect.',
    goalType: 'cleanDays',
    goalArgs: {},
    tiers: [3, 7, 30, 90, 180],
    tierNames: ['The First Three', 'One Week Clear', 'One Month Clear', 'Ninety Days', 'Half a Year'],
    tierNote: [
      'Three days. The hardest stretch, and the one that proves it is possible.',
      'Seven days clear.',
      'Thirty days. Withdrawal noise usually quiets somewhere around here.',
      'Ninety days clear.',
      'One hundred and eighty days. A different person keeps this streak.',
    ],
    requiresRecovery: true,
  },
  {
    chain: 'wave',
    title: 'Master of the Wave',
    attr: 'sabr',
    blurb: 'Every urge you outlast teaches your brain that it does not have to be obeyed.',
    goalType: 'urgesSurvived',
    goalArgs: {},
    tiers: [3, 10, 30, 75],
    tierNames: ['Rode It Out', 'Ten Waves', 'Thirty Waves', 'The Wave Breaks First'],
    tierNote: [
      'Survive three urges using the SOS timer.',
      'Ten. You now have evidence, not just hope.',
      'Thirty. The urge is losing its grip on the outcome.',
      'Seventy-five outlasted urges.',
    ],
    requiresRecovery: true,
  },
  {
    chain: 'deepwork',
    title: 'The Deep Work',
    attr: 'aql',
    blurb: 'Procrastination dies to started sessions, not to good intentions.',
    goalType: 'focusSessions',
    goalArgs: {},
    tiers: [5, 20, 60, 150],
    tierNames: ['Just Begun', 'Twenty Blocks', 'Sixty Blocks', 'Deep Worker'],
    tierNote: [
      'Five completed focus blocks.',
      'Twenty. Starting is measurably easier now — that is the Zeigarnik effect.',
      'Sixty focused blocks logged.',
      'One hundred and fifty. This is a professional-grade attention span.',
    ],
  },
  {
    chain: 'body',
    title: 'The Vessel',
    attr: 'jasad',
    blurb: 'Your body is an amanah, and it is also the cheapest antidepressant available.',
    goalType: 'categoryDays',
    goalArgs: { category: 'body' },
    tiers: [7, 30, 66],
    tierNames: ['Moving Again', 'One Month Moving', 'It Is Who You Are'],
    tierNote: [
      'Seven days with a body habit completed.',
      'Thirty days. Exercise at this dose has an antidepressant effect size around 0.5 (Schuch et al., 2016).',
      'Sixty-six days of caring for the vessel.',
    ],
  },
  {
    chain: 'night',
    title: 'The Night Watch',
    attr: 'waqt',
    blurb: 'You do not have a morning problem. You have an 11pm problem.',
    goalType: 'shutdowns',
    goalArgs: {},
    tiers: [5, 21, 50],
    tierNames: ['Closing the Day', 'Three Weeks of Endings', 'Guardian of the Night'],
    tierNote: [
      'Complete the shutdown ritual five times.',
      'Twenty-one shutdowns. Consistent sleep timing matters more than total hours.',
      'Fifty. Your nights stopped stealing your days.',
    ],
  },
  {
    chain: 'map',
    title: 'The Cartographer',
    attr: 'aql',
    blurb: 'A week you never reviewed is a week you cannot learn from.',
    goalType: 'reviews',
    goalArgs: {},
    tiers: [1, 4, 12, 26],
    tierNames: ['First Reckoning', 'One Month Mapped', 'A Quarter Mapped', 'Half a Year Mapped'],
    tierNote: [
      'Complete one weekly review.',
      'Four weekly reviews.',
      'Twelve. You can now see your own patterns from above.',
      'Twenty-six weeks of honest self-audit.',
    ],
  },
  {
    chain: 'architect',
    title: 'The Architect',
    attr: 'sabr',
    blurb: 'Design the environment once instead of fighting it every night.',
    goalType: 'guardsAndPlans',
    goalArgs: {},
    tiers: [3, 6, 10],
    tierNames: ['First Walls', 'Fortified', 'Nothing Left to Chance'],
    tierNote: [
      'Three defences in place — environment guards or if/then plans.',
      'Six defences. Wood & Neal (2007): context drives habit more than intention does.',
      'Ten. Willpower is now your backup, not your plan.',
    ],
  },
  {
    chain: 'scholar',
    title: 'The Scholar',
    attr: 'aql',
    blurb: 'Turning up is most of a degree. The rest is submitting on time.',
    goalType: 'classesAttended',
    goalArgs: {},
    tiers: [10, 40, 100, 250],
    tierNames: ['Present', 'Forty Classes', 'A Hundred Classes', 'Never Short'],
    tierNote: [
      'Ten classes marked present.',
      'Forty. The 8:00am slot has stopped being a negotiation.',
      'A hundred classes attended and logged.',
      'Two hundred and fifty. Short attendance is not a thing that happens to you.',
    ],
    requiresAcademics: true,
  },
  {
    chain: 'desk',
    title: 'Hours At The Desk',
    icon: 'books',
    attr: 'aql',
    blurb: 'Nobody is graded on the lectures they sat through. They are graded on the hours after them.',
    goalType: 'studyDays',
    goalArgs: {},
    tiers: [7, 30, 66],
    tierNames: ['Sat Down', 'A Month Of Hours', 'It Is Just What You Do'],
    tierNote: [
      'Seven days with real study logged.',
      'Thirty. The evening has a shape now.',
      'Sixty-six — the same number the habits run on, and for the same reason.',
    ],
    requiresAcademics: true,
  },
  {
    chain: 'submit',
    title: 'On Time',
    attr: 'waqt',
    blurb: 'The mark you lose to a late submission is the cheapest mark you will ever throw away.',
    goalType: 'uniTasksDone',
    goalArgs: {},
    tiers: [5, 20, 60],
    tierNames: ['First Five', 'Twenty Submitted', 'Sixty Submitted'],
    tierNote: [
      'Five assignments, quizzes or deadlines closed out.',
      'Twenty. Deadlines are now something you plan around, not react to.',
      'Sixty submissions logged on time.',
    ],
    requiresAcademics: true,
  },
  {
    chain: 'reciter',
    title: 'The Reciter',
    attr: 'ruh',
    blurb: 'A little every day, unbroken, is the way it was meant to be taken.',
    goalType: 'habitTitleDays',
    goalArgs: { match: 'quran' },
    tiers: [7, 30, 66],
    tierNames: ['Opened Again', 'A Month With It', 'Never Away From It'],
    tierNote: [
      'Seven days of Qur’an.',
      'Thirty days. "The most beloved deeds to Allah are the most consistent, even if small." (Bukhari 6464)',
      'Sixty-six days.',
    ],
  },
];

/** Flatten the chains into individual quests with `requires` links. */
export const MAIN_QUESTS = CHAINS.flatMap((c) =>
  c.tiers.map((target, i) => ({
    id: `${c.chain}_${i + 1}`,
    kind: 'main',
    chain: c.chain,
    chainTitle: c.title,
    tier: i + 1,
    tierCount: c.tiers.length,
    title: c.tierNames[i],
    blurb: i === 0 ? c.blurb : c.tierNote[i],
    note: c.tierNote[i],
    icon: c.icon,
    attr: c.attr,
    xp: 120 * (i + 1),
    goal: { type: c.goalType, target, ...c.goalArgs },
    requires: i === 0 ? null : `${c.chain}_${i}`,
    requiresRecovery: !!c.requiresRecovery,
    requiresAcademics: !!c.requiresAcademics,
  }))
);

export const CHAIN_META = Object.fromEntries(CHAINS.map((c) => [c.chain, c]));

/* -------------------------------------------------------------- side quests */

/**
 * Optional day-missions. `auto` quests complete themselves from your logs;
 * the rest are marked done by hand. Ignoring one costs you nothing at all —
 * that is intentional. An optional thing that punishes you is not optional.
 */
export const SIDE_QUESTS = [
  { id: 's_twomin',   title: 'The Two-Minute Gambit', attr: 'sabr',
    desc: 'Pick the habit you least want to do today. Do only the two-minute version of it.',
    why: 'Fogg’s Tiny Habits: shrink the behaviour until motivation stops being the deciding factor.' },
  { id: 's_sunlight', title: 'Sunlight Protocol', attr: 'jasad',
    desc: 'Get 10 minutes of outdoor daylight within an hour of waking.',
    why: 'Morning light is the strongest zeitgeber for the circadian clock — it sets tonight’s sleep timing.' },
  { id: 's_wave',     title: 'Ride One Wave', attr: 'sabr',
    desc: 'Next urge today: open SOS and outlast it without acting.',
    why: 'Urges rise and fall. Riding one out without acting weakens the loop that feeds it.' },
  { id: 's_sadaqah',  title: 'Sadaqah Run', attr: 'ruh',
    desc: 'Give something today, however small. Money, food, or genuinely useful help.',
    why: '"Protect yourself from the Fire, even with half a date." (Bukhari 1417)' },
  { id: 's_silent',   title: 'The Silent Hour', attr: 'waqt',
    desc: 'One full hour with your phone in another room.',
    why: 'Mere presence of a phone measurably reduces available cognitive capacity (Ward et al., 2017).' },
  { id: 's_istighfar',title: 'Istighfar × 100', attr: 'ruh',
    desc: 'Say astaghfirullah one hundred times across today.',
    why: 'The Prophet \u{FDFA} said he sought forgiveness a hundred times a day. (Muslim 2702)' },
  { id: 's_cold',     title: 'Cold Finish', attr: 'jasad',
    desc: 'End your shower with 30 seconds of cold water.',
    why: 'A small, chosen, voluntary discomfort. You are rehearsing acting against how you feel.' },
  { id: 's_rahim',    title: 'Keep the Ties', attr: 'ruh',
    desc: 'Call or message a relative you have drifted from.',
    why: 'Silat ar-rahim. Also: loneliness is one of the most reliable relapse triggers there is.' },
  { id: 's_mulk',     title: 'Surah Al-Mulk', attr: 'ruh',
    desc: 'Recite Surah Al-Mulk before you sleep tonight.',
    why: 'A sunnah before sleep (Tirmidhi 2891) — and a screen-free anchor at the exact hour you slip.' },
  { id: 's_debt',     title: 'Pay the Oldest Debt', attr: 'waqt',
    desc: 'The task you have postponed longest: work on it for ten minutes. Only ten.',
    why: 'Starting is the whole cost. The Zeigarnik effect does the rest of the pulling.' },
  { id: 's_braindump',title: 'Empty the Loops', attr: 'aql',
    desc: 'Write down every open loop in your head. All of them. Paper, not the phone.',
    why: 'Unfinished intentions occupy working memory until they are recorded somewhere trusted.' },
  { id: 's_gratitude',title: 'Gratitude Triad', attr: 'aql',
    desc: 'Write three specific things you are grateful for. Specific, not generic.',
    why: 'Emmons & McCullough (2003): weekly gratitude writing raised wellbeing and optimism.' },
  { id: 's_walk',     title: 'Walk After Maghrib', attr: 'jasad',
    desc: 'Fifteen minutes of walking after Maghrib. No phone, no earphones.',
    why: 'Light evening movement helps sleep onset, and it removes you from the room where you slip.' },
  { id: 's_noscreen', title: 'The Last Hour', attr: 'waqt',
    desc: 'No screens for the 60 minutes before bed.',
    why: 'The bigger effect is not blue light — it is that the content keeps you awake and reachable.' },
  { id: 's_fast',     title: 'Fast Today', attr: 'sabr',
    desc: 'Fast today (Monday or Thursday if you can choose).',
    why: '"Whoever is not able, let him fast, for it is a shield for him." (Bukhari 5065)' },
  { id: 's_duha',     title: 'Salat al-Duha', attr: 'ruh',
    desc: 'Pray two rak’ah of Duha after the sun has risen.',
    why: 'A gentle sunnah that plants a second anchor into your morning.' },
  { id: 's_reset',    title: 'Room Reset', attr: 'aql',
    desc: 'Ten minutes tidying the room you spend the most time in.',
    why: 'You are editing the cues in your environment, and cues beat willpower.' },
  { id: 's_analog',   title: 'Analog Morning', attr: 'waqt',
    desc: 'No phone for the first 30 minutes after waking.',
    why: 'The first input of the day sets the attention pattern for the rest of it.' },
  { id: 's_water',    title: 'Water First', attr: 'jasad',
    desc: 'Half a litre of water before anything else today.',
    why: 'A frictionless win in the first two minutes of the day. Momentum is real.' },
  { id: 's_no',       title: 'Say No Once', attr: 'sabr',
    desc: 'Decline one request or invitation today that does not serve where you are going.',
    why: 'Every yes is a withdrawal from a fixed account. Practise the refusal deliberately.' },
  { id: 's_kursi',    title: 'Ayat al-Kursi × 5', attr: 'ruh',
    desc: 'Recite Ayat al-Kursi after each of the five fard prayers today.',
    why: 'Habit stacking onto something already fixed in your day — the cheapest way to add a habit.' },
  { id: 's_block',    title: 'One Deep Block', attr: 'aql',
    desc: 'One 25-minute focus block on the thing that actually matters.',
    why: 'One block beats a planned four hours that never start.' },
  { id: 's_notify',   title: 'Kill a Notification', attr: 'waqt',
    desc: 'Permanently turn off notifications for one app.',
    why: 'One minute of work today, removing hundreds of interruptions from every week after.' },
  { id: 's_read',     title: 'Ten Pages', attr: 'aql',
    desc: 'Read ten pages of a real book.',
    why: 'Ten pages a day is roughly a dozen books a year. Small and unbroken beats big and rare.' },
  { id: 's_pushups',  title: 'One Hard Set', attr: 'jasad',
    desc: 'One set of push-ups taken close to failure.',
    why: 'Ninety seconds. Enough to shift your mood and prove the day is not over.' },
  { id: 's_forgive',  title: 'Let One Thing Go', attr: 'ruh',
    desc: 'Forgive one thing you have been holding on to. Say nothing to anyone.',
    why: 'Resentment is a slow drain on the same energy you need for everything else here.' },
];

/**
 * Side-quest themes. Every side quest already feeds one attribute, so the theme
 * is derived from that rather than being a second thing to keep in sync — one
 * source of truth, one colour, one label.
 */
export const SIDE_THEMES = {
  ruh:   { id: 'ruh',   label: 'Spiritual',  icon: 'ruh',   color: 'var(--green)',  tone: 'accent' },
  jasad: { id: 'jasad', label: 'Physical',   icon: 'jasad', color: 'var(--orange)', tone: 'orange' },
  aql:   { id: 'aql',   label: 'Mental',     icon: 'aql',   color: 'var(--blue)',   tone: 'blue' },
  sabr:  { id: 'sabr',  label: 'Discipline', icon: 'sabr',  color: 'var(--purple)', tone: 'violet' },
  waqt:  { id: 'waqt',  label: 'Time',       icon: 'waqt',  color: 'var(--gold)',   tone: 'gold' },
};
export const SIDE_THEME_ORDER = ['ruh', 'jasad', 'aql', 'sabr', 'waqt'];

export function themeOf(quest) {
  return SIDE_THEMES[quest.attr] || SIDE_THEMES.aql;
}

/** Side quests grouped by theme, for the browse-all view. */
export function sideQuestsByTheme() {
  return SIDE_THEME_ORDER.map((id) => ({
    theme: SIDE_THEMES[id],
    quests: SIDE_QUESTS.filter((q) => q.attr === id),
  })).filter((g) => g.quests.length);
}

export const SIDE_BY_ID = Object.fromEntries(SIDE_QUESTS.map((q) => [q.id, q]));
export const QUEST_BY_ID = Object.fromEntries([
  ...MAIN_QUESTS.map((q) => [q.id, q]),
  ...SIDE_QUESTS.map((q) => [q.id, { ...q, kind: 'side', xp: 40 }]),
]);
