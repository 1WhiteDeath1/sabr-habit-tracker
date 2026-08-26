// scripture.js — Qur'an and Sunnah material, tagged by the moment it should appear.
//
// `moments` decides where a passage surfaces: at Fajr, mid-urge, after a lapse,
// when you are stalling, when a streak breaks. Nothing here is random filler.
//
// Translations are conveyed meanings, not the Qur'an itself. References are
// given for everything so you can verify against a mushaf or a hadith database
// rather than taking an app's word for it.

export const AYAT = [
  {
    ref: 'Ar-Ra‘d 13:11',
    ar: 'إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ',
    en: 'Indeed, Allah will not change the condition of a people until they change what is in themselves.',
    moments: ['morning', 'stalling', 'review'],
  },
  {
    ref: 'Ash-Sharh 94:5–6',
    ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۘ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    en: 'So indeed, with hardship comes ease. Indeed, with hardship comes ease.',
    moments: ['urge', 'lapse', 'hard'],
  },
  {
    ref: 'Al-Baqarah 2:286',
    ar: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    en: 'Allah does not burden a soul beyond what it can bear.',
    moments: ['hard', 'lapse', 'overwhelmed'],
  },
  {
    ref: 'Az-Zumar 39:53',
    ar: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
    en: 'Do not despair of the mercy of Allah.',
    moments: ['lapse', 'streakbroken', 'hard'],
  },
  {
    ref: 'An-Nur 24:30',
    ar: 'قُل لِّلْمُؤْمِنِينَ يَغُضُّوا مِنْ أَبْصَارِهِمْ',
    en: 'Tell the believing men to lower their gaze and to guard their chastity. That is purer for them.',
    moments: ['urge', 'shield'],
  },
  {
    ref: 'Al-‘Asr 103:1–3',
    ar: 'وَالْعَصْرِ ۘ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ',
    en: 'By time — indeed, mankind is in loss, except those who believe, do righteous deeds, and counsel one another to truth and to patience.',
    moments: ['stalling', 'time', 'morning'],
  },
  {
    ref: 'Al-‘Ankabut 29:69',
    ar: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
    en: 'And those who strive for Us — We will surely guide them to Our ways.',
    moments: ['urge', 'hard', 'streakbroken'],
  },
  {
    ref: 'At-Talaq 65:2–3',
    ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
    en: 'And whoever is mindful of Allah, He will make a way out for him.',
    moments: ['urge', 'overwhelmed'],
  },
  {
    ref: 'Ibrahim 14:7',
    ar: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    en: 'If you are grateful, I will certainly give you more.',
    moments: ['night', 'review'],
  },
  {
    ref: 'Ta-Ha 20:14',
    ar: 'وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
    en: 'And establish prayer for My remembrance.',
    moments: ['morning', 'prayer'],
  },
  {
    ref: 'Al-Baqarah 2:152',
    ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ',
    en: 'So remember Me; I will remember you.',
    moments: ['morning', 'prayer', 'night'],
  },
];

export const AHADITH = [
  {
    ref: 'Bukhari 6464, Muslim 783',
    ar: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    en: 'The deeds most beloved to Allah are the most consistent, even if they are small.',
    note: 'The entire design of this app is downstream of this hadith.',
    moments: ['morning', 'stalling', 'review', 'tiny'],
  },
  {
    ref: 'Tirmidhi 2499',
    en: 'Every son of Adam sins, and the best of those who sin are those who repent.',
    note: 'Falling is expected. Staying down is the only real failure.',
    moments: ['lapse', 'streakbroken'],
  },
  {
    ref: 'Bukhari 5065, Muslim 1400',
    en: 'Whoever among you is able to marry, let him marry. And whoever is not able, let him fast, for it is a shield for him.',
    note: 'Fasting is prescribed here as a direct, practical measure — not a metaphor.',
    moments: ['shield', 'urge'],
  },
  {
    ref: 'Bukhari 6412',
    en: 'There are two blessings which many people lose: health and free time.',
    moments: ['time', 'stalling', 'morning'],
  },
  {
    ref: 'Al-Hakim, al-Mustadrak 7846 (graded sahih by al-Hakim, agreed by adh-Dhahabi)',
    en: 'Take advantage of five before five: your youth before your old age, your health before your illness, your wealth before your poverty, your free time before your preoccupation, and your life before your death.',
    moments: ['time', 'stalling', 'review'],
  },
  {
    ref: 'Muslim 2664',
    en: 'The strong believer is better and more beloved to Allah than the weak believer, though there is good in both. Strive for what benefits you, seek help from Allah, and do not feel helpless.',
    note: 'Strength here is of body and of will, and both are asked of you.',
    moments: ['body', 'hard', 'stalling'],
  },
  {
    ref: 'Muslim 2702',
    en: 'The Prophet \u{FDFA} said: I seek Allah’s forgiveness and repent to Him a hundred times a day.',
    moments: ['lapse', 'night'],
  },
  {
    ref: 'Bukhari 1, Muslim 1907',
    en: 'Actions are but by intentions, and every person will have only what he intended.',
    moments: ['morning', 'review'],
  },
  {
    ref: 'Tirmidhi 2346',
    en: 'Whoever wakes up secure in his home, healthy in his body, with food for the day — it is as if the whole world has been given to him.',
    moments: ['night', 'hard', 'review'],
  },
  {
    ref: 'Abu Dawud 4833, Tirmidhi 2378',
    en: 'A person is upon the way of his close friend, so let each of you look at whom he takes as a friend.',
    moments: ['shield', 'review'],
  },
  {
    ref: 'Bukhari 1417',
    en: 'Protect yourself from the Fire, even with half a date given in charity.',
    moments: ['sadaqah'],
  },
];

/** Everything, in one list, so a moment lookup can search both. */
export const ALL_PASSAGES = [
  ...AYAT.map((a) => ({ ...a, source: 'quran' })),
  ...AHADITH.map((h) => ({ ...h, source: 'hadith' })),
];

/**
 * Pick a passage for a moment. Deterministic per (moment, seed) so it stays
 * put while you look at it, and rotates day to day.
 */
export function passageFor(moment, seed = '') {
  const pool = ALL_PASSAGES.filter((p) => p.moments.includes(moment));
  const list = pool.length ? pool : ALL_PASSAGES;
  const key = `${moment}|${seed}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return list[(h >>> 0) % list.length];
}

/** Short duas surfaced in the SOS flow and the night routine. */
export const DUAS = [
  {
    id: 'anxiety',
    label: 'When the chest tightens',
    ar: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
    tr: 'Allahumma inni a‘udhu bika min al-hammi wal-hazan',
    en: 'O Allah, I seek refuge in You from anxiety and grief.',
    ref: 'Bukhari 6369',
  },
  {
    id: 'steadfast',
    label: 'For a heart that keeps turning',
    ar: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَىٰ دِينِكَ',
    tr: 'Ya muqallib al-qulub, thabbit qalbi ‘ala dinik',
    en: 'O Turner of hearts, make my heart firm upon Your religion.',
    ref: 'Tirmidhi 2140',
  },
  {
    id: 'strength',
    label: 'When you have nothing left',
    ar: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    tr: 'Hasbunallahu wa ni‘mal-wakeel',
    en: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
    ref: 'Qur’an 3:173',
  },
];
