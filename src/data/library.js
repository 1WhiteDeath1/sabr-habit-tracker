// library.js — the curated habit library you pick from instead of starting blank.
//
// Every entry arrives pre-filled with the three things people normally never
// write down and therefore never do: a cue, a two-minute version, and the
// reason it belongs in a life. You can edit all of it after adding.

export const PACKS = [
  {
    id: 'foundation',
    title: 'The Five',
    subtitle: 'The anchors everything else attaches to',
    icon: 'worship',
    blurb: 'Start here even if you start nowhere else. These are already fixed points in your day, which makes them the cheapest habit cues you will ever get.',
  },
  {
    id: 'quran',
    title: 'Qur’an & Dhikr',
    subtitle: 'Daily, small, unbroken',
    icon: 'book',
    blurb: 'Consistency over volume. A page every day outlasts a juz once a month.',
  },
  {
    id: 'body',
    title: 'Body',
    subtitle: 'Movement, food, water, sun',
    icon: 'body',
    blurb: 'The fastest available lever on mood, energy and sleep — and an amanah you will be asked about.',
  },
  {
    id: 'mind',
    title: 'Mind & Work',
    subtitle: 'Attention, output, clarity',
    icon: 'mind',
    blurb: 'Procrastination is not a character flaw. It is an unstructured start.',
  },
  {
    id: 'night',
    title: 'Night & Sleep',
    subtitle: 'Where your mornings are actually decided',
    icon: 'moon',
    blurb: 'Almost every ruined morning was set up the night before, between 10pm and 1am.',
  },
  {
    id: 'shield',
    title: 'Shield',
    subtitle: 'Guarding the gaze and the heart',
    icon: 'shield',
    blurb: 'Practical, prescribed measures — not willpower dressed up as advice.',
  },
];

/**
 * `evidence` points at a key in data/research.js. `proof` is a scripture
 * reference shown on the habit's detail card.
 */
export const LIBRARY = [
  /* ---------------------------------------------------------- foundation */
  { pack: 'foundation', title: 'Fajr on time', category: 'worship', difficulty: 4,
    anchorPrayer: 'fajr', slot: 'morning',
    cue: 'When my alarm goes for Fajr, I get out of bed before I open my eyes properly.',
    tiny: 'Sit up and put both feet on the floor.',
    full: 'Wudu and pray Fajr in its time.',
    why: 'The whole day is downstream of this one.',
    evidence: 'habitStacking', proof: 'Ta-Ha 20:14' },

  { pack: 'foundation', title: 'Dhuhr on time', category: 'worship', difficulty: 2,
    anchorPrayer: 'dhuhr', slot: 'midday',
    cue: 'When I hear the adhan for Dhuhr, I stop what I am doing and make wudu.',
    tiny: 'Make wudu.', full: 'Pray Dhuhr in its time.',
    evidence: 'habitStacking' },

  { pack: 'foundation', title: 'Asr on time', category: 'worship', difficulty: 2,
    anchorPrayer: 'asr', slot: 'evening',
    cue: 'When the Asr window opens, I pray before I start anything new.',
    tiny: 'Make wudu.', full: 'Pray Asr in its time.',
    evidence: 'habitStacking' },

  { pack: 'foundation', title: 'Maghrib on time', category: 'worship', difficulty: 2,
    anchorPrayer: 'maghrib', slot: 'evening',
    cue: 'When the sun sets, I pray Maghrib before eating.',
    tiny: 'Make wudu.', full: 'Pray Maghrib in its time.',
    evidence: 'habitStacking' },

  { pack: 'foundation', title: 'Isha on time', category: 'worship', difficulty: 2,
    anchorPrayer: 'isha', slot: 'night',
    cue: 'When Isha comes in, I pray it — I do not push it to "later tonight".',
    tiny: 'Make wudu.', full: 'Pray Isha in its time.',
    why: 'Delaying Isha is how the whole night gets away from you.',
    evidence: 'habitStacking' },

  { pack: 'foundation', title: 'Sunnah rawatib', category: 'worship', difficulty: 3,
    anchorPrayer: 'dhuhr', slot: 'midday',
    cue: 'After a fard prayer, I stay on the mat for the sunnah instead of standing up.',
    tiny: 'Two rak‘ah.', full: 'The full sunnah rawatib for that prayer.',
    evidence: 'habitStacking' },

  { pack: 'foundation', title: 'Ayat al-Kursi after salah', category: 'worship', difficulty: 1,
    anchorPrayer: 'fajr', slot: 'anytime',
    cue: 'After the tasleem, before I stand, I recite Ayat al-Kursi.',
    tiny: 'Once, after one prayer.', full: 'After all five.',
    evidence: 'habitStacking' },

  /* --------------------------------------------------------------- quran */
  { pack: 'quran', title: 'Qur’an daily', category: 'worship', difficulty: 3,
    anchorPrayer: 'fajr', slot: 'morning',
    cue: 'After I pray Fajr, I open the mushaf before I stand up from the mat.',
    tiny: 'Read three ayat.',
    full: 'Read one page with meaning.',
    why: 'Small and every day beats large and occasional.',
    evidence: 'twoMinuteRule', proof: 'Bukhari 6464' },

  { pack: 'quran', title: 'Morning adhkar', category: 'worship', difficulty: 2,
    anchorPrayer: 'fajr', slot: 'morning',
    cue: 'After Fajr, I stay seated and read the morning adhkar.',
    tiny: 'Three tasbihat.', full: 'The full morning adhkar.',
    evidence: 'habitStacking' },

  { pack: 'quran', title: 'Evening adhkar', category: 'worship', difficulty: 2,
    anchorPrayer: 'asr', slot: 'evening',
    cue: 'After Asr, I read the evening adhkar before I pick up my phone.',
    tiny: 'Three tasbihat.', full: 'The full evening adhkar.',
    evidence: 'habitStacking' },

  { pack: 'quran', title: 'Istighfar ×100', category: 'worship', difficulty: 1,
    slot: 'anytime',
    cue: 'While I walk or commute, I say astaghfirullah until I reach a hundred.',
    tiny: 'Ten times.', full: 'One hundred across the day.',
    evidence: 'temptationBundling', proof: 'Muslim 2702' },

  { pack: 'quran', title: 'Salawat on the Prophet \u{FDFA}', category: 'worship', difficulty: 1,
    slot: 'anytime',
    cue: 'Every time I unlock my phone in the evening, I send salawat once.',
    tiny: 'Ten times.', full: 'One hundred, and more on Friday.',
    evidence: 'habitStacking' },

  { pack: 'quran', title: 'Surah al-Kahf on Friday', category: 'worship', difficulty: 2,
    slot: 'morning', cadence: { type: 'weekdays', days: [5] },
    cue: 'On Friday morning before I do anything else, I read Surah al-Kahf.',
    tiny: 'The first ten ayat.', full: 'The whole surah.',
    evidence: 'implementationIntentions' },

  { pack: 'quran', title: 'Duha prayer', category: 'worship', difficulty: 3,
    slot: 'morning',
    cue: 'When the sun is well up and before Dhuhr, I pray two rak‘ah of Duha.',
    tiny: 'Two rak‘ah.', full: 'Four rak‘ah.',
    evidence: 'habitStacking' },

  /* ---------------------------------------------------------------- body */
  { pack: 'body', title: 'Move for 20 minutes', category: 'body', difficulty: 3,
    slot: 'morning', cadence: { type: 'times', perWeek: 5 },
    cue: 'After Fajr and the morning adhkar, I put my shoes on and go out.',
    tiny: 'Put your shoes on and step outside.',
    full: 'Twenty minutes brisk, or a full workout.',
    why: 'The cheapest antidepressant available to you.',
    evidence: 'exerciseMood', proof: 'Muslim 2664' },

  { pack: 'body', title: 'Strength training', category: 'body', difficulty: 4,
    slot: 'evening', cadence: { type: 'times', perWeek: 3 },
    cue: 'On my training days, I train straight after Asr.',
    tiny: 'One set of push-ups.',
    full: 'The full session.',
    evidence: 'exerciseMood', proof: 'Muslim 2664' },

  { pack: 'body', title: 'Water on waking', category: 'body', difficulty: 1,
    slot: 'morning', anchorPrayer: 'fajr',
    cue: 'The glass is on my desk before I sleep. I drink it before I touch my phone.',
    tiny: 'A few sips.', full: 'Half a litre.',
    evidence: 'environmentDesign' },

  { pack: 'body', title: 'Morning daylight', category: 'body', difficulty: 1,
    slot: 'morning',
    cue: 'Within an hour of waking, I stand outside for ten minutes without my phone.',
    tiny: 'Open the curtains and stand at the window for two minutes.',
    full: 'Ten minutes outdoors.',
    why: 'This is what actually fixes your sleep — not trying harder at bedtime.',
    evidence: 'sleepConsistency' },

  { pack: 'body', title: 'Stop eating at two-thirds', category: 'body', difficulty: 3,
    slot: 'anytime',
    cue: 'When I feel almost full, I stop and stand up from the table.',
    tiny: 'Notice it once today.', full: 'Every meal.',
    why: 'A third for food, a third for drink, a third for breath.',
    proof: 'Tirmidhi 2380' },

  { pack: 'body', title: 'Fast Monday & Thursday', category: 'body', difficulty: 5,
    slot: 'anytime', cadence: { type: 'weekdays', days: [1, 4] },
    cue: 'On Monday and Thursday I make the intention the night before.',
    tiny: 'Make the intention.', full: 'Fast the day.',
    why: 'Prescribed directly as a shield.',
    evidence: 'implementationIntentions', proof: 'Bukhari 5065' },

  { pack: 'body', title: 'No food after Isha', category: 'body', difficulty: 3,
    slot: 'night', anchorPrayer: 'isha',
    cue: 'After Isha, the kitchen is closed.',
    tiny: 'No full meal after Isha.', full: 'Nothing but water after Isha.',
    evidence: 'environmentDesign' },

  /* ---------------------------------------------------------------- mind */
  { pack: 'mind', title: 'Deep work block', category: 'work', difficulty: 4,
    slot: 'morning',
    cue: 'After Fajr and breakfast, I sit down and start a 25-minute block before opening anything else.',
    tiny: 'Start a two-minute block.',
    full: 'Two 25-minute blocks, phone in another room.',
    why: 'You do not need more hours. You need the first block to start.',
    evidence: 'zeigarnik' },

  { pack: 'mind', title: 'Plan tomorrow tonight', category: 'work', difficulty: 2,
    slot: 'night', anchorPrayer: 'isha',
    cue: 'After Isha, I write the three things that must happen tomorrow.',
    tiny: 'Write one thing.', full: 'Three tasks, each with a time and a place.',
    why: 'Deciding in advance is the intervention. Doing it tired is not.',
    evidence: 'implementationIntentions' },

  { pack: 'mind', title: 'Read ten pages', category: 'mind', difficulty: 2,
    slot: 'night',
    cue: 'The book is on my pillow. I read before I lie down, not after.',
    tiny: 'One page.', full: 'Ten pages.',
    evidence: 'environmentDesign' },

  { pack: 'mind', title: 'No phone for the first 30 minutes', category: 'mind', difficulty: 3,
    slot: 'morning',
    cue: 'My phone charges across the room. I do not touch it until after Fajr and adhkar.',
    tiny: 'Charge it outside the bedroom tonight.',
    full: 'Thirty phone-free minutes after waking.',
    why: 'Whatever you feed your attention first, it keeps eating all day.',
    evidence: 'environmentDesign' },

  { pack: 'mind', title: 'Brain dump', category: 'mind', difficulty: 1,
    slot: 'evening',
    cue: 'When my head feels crowded, I write every open loop on paper.',
    tiny: 'Write three.', full: 'Empty the whole list.',
    evidence: 'zeigarnik' },

  { pack: 'mind', title: 'Gratitude — three specifics', category: 'mind', difficulty: 1,
    slot: 'night',
    cue: 'After Isha, I write three specific things from today.',
    tiny: 'One thing.', full: 'Three specific things.',
    evidence: 'gratitude', proof: 'Ibrahim 14:7' },

  /* --------------------------------------------------------------- night */
  { pack: 'night', title: 'Shutdown ritual', category: 'sleep', difficulty: 3,
    slot: 'night', anchorPrayer: 'isha',
    cue: 'At my set time, I close everything, plan tomorrow, and say the day is over.',
    tiny: 'Say out loud: the day is finished.',
    full: 'Plan tomorrow, phone out of the room, lights down.',
    why: 'A day with no ending bleeds into the next one.',
    evidence: 'sleepConsistency' },

  { pack: 'night', title: 'Phone out of the bedroom', category: 'sleep', difficulty: 3,
    slot: 'night',
    cue: 'When I pray Isha, the phone goes on the charger in the other room.',
    tiny: 'Put it face-down across the room.',
    full: 'Out of the bedroom entirely, alarm on a clock.',
    why: 'This single change removes most late-night slips at the source.',
    evidence: 'environmentDesign' },

  { pack: 'night', title: 'Surah al-Mulk before sleep', category: 'worship', difficulty: 2,
    slot: 'night',
    cue: 'When I get into bed, I read Surah al-Mulk before anything else.',
    tiny: 'The first five ayat.', full: 'The whole surah.',
    proof: 'Tirmidhi 2891', evidence: 'habitStacking' },

  { pack: 'night', title: 'Wudu before sleeping', category: 'worship', difficulty: 1,
    slot: 'night',
    cue: 'Before I lie down, I make wudu and sleep on my right side.',
    tiny: 'Make wudu.', full: 'Wudu, adhkar, right side.',
    proof: 'Bukhari 247' },

  { pack: 'night', title: 'In bed by target time', category: 'sleep', difficulty: 4,
    slot: 'night',
    cue: 'At my target time the lights go off, finished or not.',
    tiny: 'Lights off within 30 minutes of target.',
    full: 'In bed at target, no screens for the hour before.',
    why: 'Regularity of timing matters more than total hours.',
    evidence: 'sleepConsistency' },

  { pack: 'night', title: 'Fixed wake time', category: 'sleep', difficulty: 4,
    slot: 'morning',
    cue: 'I get up at the same time every day, including weekends, regardless of when I slept.',
    tiny: 'Get up within 30 minutes of target.',
    full: 'Same wake time every day.',
    evidence: 'sleepConsistency' },

  /* -------------------------------------------------------------- shield */
  { pack: 'shield', title: 'Lower the gaze', category: 'purity', difficulty: 5,
    slot: 'anytime',
    cue: 'The moment my eyes land on something they should not, I look away before the second look.',
    tiny: 'Catch it once today and look away.',
    full: 'All day, first look away, no second look.',
    why: 'The battle is won at the first glance, not the fifth minute.',
    proof: 'An-Nur 24:30', evidence: 'urgeSurfing' },

  { pack: 'shield', title: 'No phone in bed', category: 'purity', difficulty: 3,
    slot: 'night',
    cue: 'The bed is for sleeping. The phone does not come into it.',
    tiny: 'Phone stays on the desk tonight.',
    full: 'Phone out of the room entirely.',
    why: 'This is the single highest-yield change in the whole Shield section.',
    evidence: 'environmentDesign' },

  { pack: 'shield', title: 'No phone in the bathroom', category: 'purity', difficulty: 2,
    slot: 'anytime',
    cue: 'The phone stays outside the door. Every time.',
    tiny: 'Once today.', full: 'Every time, no exceptions.',
    evidence: 'environmentDesign' },

  { pack: 'shield', title: 'Check in with my accountability partner', category: 'purity', difficulty: 2,
    slot: 'evening', cadence: { type: 'times', perWeek: 2 },
    cue: 'Twice a week I send an honest one-line update, good or bad.',
    tiny: 'Send one line.', full: 'An honest update with what triggered what.',
    proof: 'Abu Dawud 4833' },

  { pack: 'shield', title: 'Wudu when the urge comes', category: 'purity', difficulty: 2,
    slot: 'anytime',
    cue: 'When an urge starts, I get up and make wudu before I do anything else.',
    tiny: 'Stand up and leave the room.',
    full: 'Wudu, then two rak‘ah.',
    why: 'It breaks the physical loop and changes the room you are standing in.',
    evidence: 'urgeSurfing' },

  { pack: 'shield', title: 'Never alone with a screen after midnight', category: 'purity', difficulty: 4,
    slot: 'night',
    cue: 'After midnight, no screens in a room by myself.',
    tiny: 'Notice when it happens.', full: 'Hold the line every night.',
    evidence: 'environmentDesign' },
];

/** Library entries for one pack, in declaration order. */
export function packItems(packId) {
  return LIBRARY.filter((h) => h.pack === packId);
}

/** A starter set, offered during onboarding based on chosen motivations. */
export function starterSetFor(motivations = []) {
  const picks = ['Fajr on time', 'Qur’an daily', 'Move for 20 minutes'];
  if (motivations.includes('purity')) picks.push('Lower the gaze', 'No phone in bed');
  if (motivations.includes('time')) picks.push('Deep work block', 'No phone for the first 30 minutes');
  if (motivations.includes('health')) picks.push('Morning daylight', 'Water on waking');
  if (motivations.includes('discipline')) picks.push('Fixed wake time', 'Shutdown ritual');
  if (motivations.includes('deen')) picks.push('Morning adhkar', 'Isha on time');
  return LIBRARY.filter((h) => picks.includes(h.title));
}
