// exercises.js — the movement ladders.
//
// Pure data, zero imports, so core/training.js and the screen can both read it
// without an import cycle.
//
// ---------------------------------------------------------------------------
// The shape of the thing
//
// Five movement patterns — push, pull, legs, core, heart — and each one is a
// LADDER of six rungs from something almost anyone can do today up to something
// that takes months. You stand on exactly one rung per pattern, and your
// "round" is one set of each rung you are standing on.
//
// The famous version of this is 5 pull-ups, 10 push-ups, 15 squats. That is the
// `classic` routine below and it is the fourth rung of three ladders. Somebody
// who cannot do a single pull-up is not failing that routine — they are two
// rungs down it, doing towel rows, and the app should say so rather than
// showing them a target they will quietly stop opening.
//
// ---------------------------------------------------------------------------
// `target` and `pts`
//
// `target` is one honest set on that rung: enough to be worth doing, low enough
// that a bad day still clears it. `pts` is what hitting that target exactly is
// worth — the unit the whole progress view is drawn in. Two things follow from
// pts being per-rung rather than per-rep, and both are the point:
//
//   1. Ten wall push-ups and ten real push-ups are not the same day's work, and
//      the graph knows it.
//   2. Moving up a rung makes the SAME number of reps score more, so the line
//      goes up when you get stronger and not only when you do more.
//
// Anything below the target still scores, pro rata. Half a set is half a set,
// not a failure.

/** How a rung is counted. Holds are counted in seconds, everything else in reps. */
export const UNIT = { REPS: 'reps', SEC: 'sec' };

/** What you need to be able to do it. Shown on every rung, because the single
 *  fastest way to lose someone is to offer them an exercise they cannot set up. */
export const GEAR = {
  none:  { id: 'none',  label: 'Nothing' },
  wall:  { id: 'wall',  label: 'A wall' },
  chair: { id: 'chair', label: 'A chair' },
  table: { id: 'table', label: 'A sturdy table or desk' },
  towel: { id: 'towel', label: 'A towel and a door' },
  bar:   { id: 'bar',   label: 'A pull-up bar' },
};

export const MOVEMENTS = {
  push: {
    id: 'push',
    label: 'Push',
    emoji: '\u{1F44A}',
    what: 'Chest, shoulders, triceps',
    rungs: [
      { id: 'wall',    label: 'Wall push-up',     short: 'wall push-ups', target: 12, unit: UNIT.REPS, pts: 8,  gear: 'wall',
        cue: 'Hands on the wall at chest height, body one straight line, nose to the wall and back.' },
      { id: 'incline', label: 'Incline push-up',  short: 'incline push-ups', target: 10, unit: UNIT.REPS, pts: 12, gear: 'table',
        cue: 'Hands on a desk or the edge of a bed. The lower the surface, the harder it gets.' },
      { id: 'knee',    label: 'Knee push-up',     short: 'knee push-ups', target: 10, unit: UNIT.REPS, pts: 16, gear: 'none',
        cue: 'Knees down, hips forward — no folding at the waist. Chest to the floor, not chin.' },
      { id: 'full',    label: 'Push-up',          short: 'push-ups', target: 10, unit: UNIT.REPS, pts: 22, gear: 'none',
        cue: 'Elbows about 45° from your ribs, not flared wide. Whole body moves as one plank.' },
      { id: 'diamond', label: 'Diamond push-up',  short: 'diamond push-ups', target: 8,  unit: UNIT.REPS, pts: 28, gear: 'none',
        cue: 'Hands together under your chest, thumbs and index fingers touching. Triceps do the work.' },
      { id: 'archer',  label: 'Archer push-up',   short: 'archer push-ups', target: 6,  unit: UNIT.REPS, pts: 36, gear: 'none',
        cue: 'Wide hands, lower toward one hand while the other arm straightens. Alternate sides.' },
    ],
  },

  pull: {
    id: 'pull',
    label: 'Pull',
    emoji: '\u{1F9D7}',
    what: 'Back, biceps, grip',
    rungs: [
      { id: 'towel', label: 'Towel row on a door', short: 'towel rows', target: 12, unit: UNIT.REPS, pts: 10, gear: 'towel',
        cue: 'Towel over a closed door handle on both sides, feet close to the door, lean back and pull in.' },
      { id: 'table', label: 'Table row',           short: 'table rows', target: 8,  unit: UNIT.REPS, pts: 16, gear: 'table',
        cue: 'Lie under a sturdy table, grip the edge, body straight, pull your chest to the underside.' },
      { id: 'hang',  label: 'Dead hang',           short: 'dead hang', target: 20, unit: UNIT.SEC,  pts: 18, gear: 'bar',
        cue: 'Just hang. Shoulders active rather than shrugged up by your ears. This is where grip comes from.' },
      { id: 'neg',   label: 'Negative pull-up',    short: 'negatives', target: 5,  unit: UNIT.REPS, pts: 24, gear: 'bar',
        cue: 'Jump or step to the top, then take five slow seconds to come down. The lowering builds the pull.' },
      { id: 'chin',  label: 'Chin-up',             short: 'chin-ups', target: 5,  unit: UNIT.REPS, pts: 28, gear: 'bar',
        cue: 'Palms toward you. Easier than a pull-up — this rung exists so the jump is not a cliff.' },
      { id: 'pullup',label: 'Pull-up',             short: 'pull-ups', target: 5,  unit: UNIT.REPS, pts: 34, gear: 'bar',
        cue: 'Palms away, chin clears the bar, all the way down between reps. No kicking.' },
    ],
  },

  legs: {
    id: 'legs',
    label: 'Legs',
    emoji: '\u{1F9B5}',
    what: 'Quads, glutes, knees',
    rungs: [
      { id: 'chair',     label: 'Chair sit-to-stand',   short: 'sit-to-stands', target: 15, unit: UNIT.REPS, pts: 10, gear: 'chair',
        cue: 'Stand up from a chair without using your hands, sit back down under control.' },
      { id: 'squat',     label: 'Bodyweight squat',     short: 'squats', target: 15, unit: UNIT.REPS, pts: 15, gear: 'none',
        cue: 'Feet shoulder-width, sit back and down, knees tracking over your toes. Chest up.' },
      { id: 'jump',      label: 'Jump squat',           short: 'jump squats', target: 12, unit: UNIT.REPS, pts: 20, gear: 'none',
        cue: 'Squat, then drive up off the floor. Land soft, straight into the next one.' },
      { id: 'split',     label: 'Split squat',          short: 'split squats', target: 10, unit: UNIT.REPS, pts: 24, gear: 'none',
        cue: 'One foot forward, one back, drop the back knee toward the floor. Ten each side.' },
      { id: 'bulgarian', label: 'Bulgarian split squat',short: 'Bulgarian split squats', target: 8,  unit: UNIT.REPS, pts: 30, gear: 'chair',
        cue: 'Back foot up on a chair. Eight each side, and expect the first session to humble you.' },
      { id: 'pistolbox', label: 'Pistol squat to a chair', short: 'pistol squats', target: 6, unit: UNIT.REPS, pts: 36, gear: 'chair',
        cue: 'One leg, sit down to the chair, stand back up without the other foot touching. Six each side.' },
    ],
  },

  core: {
    id: 'core',
    label: 'Core',
    // Was U+1FAC0, the anatomical heart. It is an Emoji 13.0 codepoint (2020)
    // and the emoji font on Windows 10 and plenty of Android builds does not
    // have it, so it drew as an empty box on the picker — on the two patterns
    // a beginner is most likely to start with. Lotus is Emoji 5.0 and is the
    // better glyph anyway: everything on this ladder is a position held.
    emoji: '\u{1F9D8}',
    what: 'Abs, lower back, everything that holds you together',
    rungs: [
      { id: 'deadbug',   label: 'Dead bug',            short: 'dead bugs', target: 10, unit: UNIT.REPS, pts: 10, gear: 'none',
        cue: 'On your back, opposite arm and leg reach away while your lower back stays flat on the floor.' },
      { id: 'kneeplank', label: 'Knee plank',          short: 'knee plank', target: 20, unit: UNIT.SEC,  pts: 13, gear: 'none',
        cue: 'Forearms and knees, hips level, ribs pulled down. Squeeze rather than sag.' },
      { id: 'plank',     label: 'Plank',               short: 'plank', target: 30, unit: UNIT.SEC,  pts: 17, gear: 'none',
        cue: 'Forearms and toes, one straight line from ear to heel. Breathe — do not hold your breath.' },
      { id: 'legraise',  label: 'Lying leg raise',     short: 'leg raises', target: 10, unit: UNIT.REPS, pts: 21, gear: 'none',
        cue: 'On your back, legs straight, lift to vertical and lower slowly. Stop before your back arches.' },
      { id: 'hollow',    label: 'Hollow hold',         short: 'hollow hold', target: 20, unit: UNIT.SEC,  pts: 26, gear: 'none',
        cue: 'Lower back pressed flat, shoulders and heels just off the floor. Bend the knees to make it easier.' },
      { id: 'hangknee',  label: 'Hanging knee raise',  short: 'knee raises', target: 8,  unit: UNIT.REPS, pts: 32, gear: 'bar',
        cue: 'Hang from the bar and bring your knees to your chest without swinging.' },
    ],
  },

  heart: {
    id: 'heart',
    label: 'Heart',
    // Was U+1FAC1, lungs — same Emoji 13.0 problem, same empty box.
    emoji: '\u{1F3C3}',
    what: 'Breath, stamina, the thing that runs out first',
    rungs: [
      { id: 'march',      label: 'March in place',   short: 'marching', target: 45, unit: UNIT.SEC,  pts: 8,  gear: 'none',
        cue: 'Knees up to hip height, arms swinging. Loud enough to be exercise, quiet enough for a flat.' },
      { id: 'jacks',      label: 'Jumping jacks',    short: 'jumping jacks', target: 25, unit: UNIT.REPS, pts: 13, gear: 'none',
        cue: 'Feet out and hands overhead together. Step it out instead of jumping if the floor is thin.' },
      { id: 'highknees',  label: 'High knees',       short: 'high knees', target: 30, unit: UNIT.SEC,  pts: 18, gear: 'none',
        cue: 'Run on the spot, knees above hip height, on the balls of your feet.' },
      { id: 'mountain',   label: 'Mountain climbers',short: 'mountain climbers', target: 24, unit: UNIT.REPS, pts: 23, gear: 'none',
        cue: 'Push-up position, drive one knee to your chest and swap. Count every knee.' },
      { id: 'stepburpee', label: 'Step-back burpee', short: 'step-back burpees', target: 10, unit: UNIT.REPS, pts: 28, gear: 'none',
        cue: 'Hands down, walk the feet back, walk them in, stand up tall. No jump.' },
      { id: 'burpee',     label: 'Burpee',           short: 'burpees', target: 10, unit: UNIT.REPS, pts: 36, gear: 'none',
        cue: 'Chest to floor, jump the feet in, jump up with hands overhead. The whole thing in one breath cycle.' },
    ],
  },
};

export const MOVEMENT_ORDER = ['pull', 'push', 'legs', 'core', 'heart'];

/* ------------------------------------------------------------- lookups */

export function movement(mid) {
  return MOVEMENTS[mid] || null;
}

export function rung(mid, rid) {
  const m = MOVEMENTS[mid];
  if (!m) return null;
  return m.rungs.find((r) => r.id === rid) || null;
}

/** Position on the ladder, 0-based. -1 when the rung is unknown. */
export function rungIndex(mid, rid) {
  const m = MOVEMENTS[mid];
  if (!m) return -1;
  return m.rungs.findIndex((r) => r.id === rid);
}

/** The rung one step harder, or null at the top. */
export function nextRung(mid, rid) {
  const m = MOVEMENTS[mid];
  const i = rungIndex(mid, rid);
  if (i < 0 || i >= m.rungs.length - 1) return null;
  return m.rungs[i + 1];
}

/** The rung one step easier, or null at the bottom. */
export function prevRung(mid, rid) {
  const m = MOVEMENTS[mid];
  const i = rungIndex(mid, rid);
  if (i <= 0) return null;
  return m.rungs[i - 1];
}

/**
 * Where a movement starts when you pick it on its own.
 *
 * The gentlest rung that needs no equipment, so "just push-ups" never opens on
 * something the room cannot supply. Pull has no equipment-free rung at all, so
 * it falls back to the bottom of its ladder.
 */
export function defaultRungFor(mid) {
  const m = MOVEMENTS[mid];
  if (!m) return null;
  return m.rungs.find((r) => r.gear === 'none') || m.rungs[0];
}

/** "10 push-ups" / "30 seconds" — one set, in words. */
export function describeSet(r, reps = null) {
  const n = reps == null ? r.target : reps;
  return r.unit === UNIT.SEC ? `${n} sec` : `${n} reps`;
}

/* ------------------------------------------------------------ routines */

/**
 * Starting rounds.
 *
 * Every one of these is a real routine somebody could do tonight, and every one
 * of them names the equipment it needs up front. `plan` is a list of
 * [movement, rung] pairs in the order you would actually do them.
 */
export const ROUTINES = [
  {
    id: 'classic',
    label: 'The classic',
    sub: '5 pull-ups · 10 push-ups · 15 squats',
    blurb: 'The one everybody means when they say "I should start working out". Needs a bar.',
    plan: [['pull', 'pullup'], ['push', 'full'], ['legs', 'squat']],
  },
  {
    id: 'nobar',
    label: 'No bar',
    sub: 'Table row · push-up · squat · plank',
    blurb: 'The same shape as the classic, built out of furniture you already own.',
    plan: [['pull', 'table'], ['push', 'full'], ['legs', 'squat'], ['core', 'plank']],
  },
  {
    id: 'gentle',
    label: 'From nothing',
    sub: 'Wall push-up · sit-to-stand · dead bug',
    blurb: 'For a body that has not trained in years, or one coming back from illness. It is meant to feel too easy — that is the whole design.',
    plan: [['push', 'wall'], ['legs', 'chair'], ['core', 'deadbug']],
  },
  {
    id: 'quiet',
    label: 'Quiet flat',
    sub: 'Nothing that thuds on the floor',
    blurb: 'No jumping, no impact. For a first-floor room, a sleeping household, or a downstairs neighbour.',
    plan: [['push', 'knee'], ['legs', 'squat'], ['core', 'plank'], ['heart', 'march']],
  },
  {
    id: 'full',
    label: 'All five',
    sub: 'Pull · push · legs · core · heart',
    blurb: 'One set of every pattern. Longest of the five, and the most complete.',
    plan: [['pull', 'towel'], ['push', 'knee'], ['legs', 'squat'], ['core', 'plank'], ['heart', 'jacks']],
  },
];

export function routine(id) {
  return ROUTINES.find((r) => r.id === id) || null;
}

/** Every distinct piece of equipment a plan needs, as labels. */
export function gearFor(plan = []) {
  const out = [];
  for (const item of plan) {
    const r = rung(item.mid, item.rung);
    if (!r || r.gear === 'none') continue;
    const label = GEAR[r.gear]?.label;
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
