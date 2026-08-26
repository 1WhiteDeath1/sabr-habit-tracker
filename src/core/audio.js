// audio.js — the app's sounds, synthesised rather than downloaded.
//
// No .mp3 files. This app ships as static files with no build step and stores
// everything on the device, and a folder of audio assets would work against all
// of that — bytes to download, a cache to version, a licence to track. Every
// sound here is a few oscillators and an envelope, which costs about 4KB of
// code and nothing at runtime.
//
// Two rules about the sounds themselves:
//
//   Nothing is punitive. There is no buzzer, no failure sting. Undoing a habit
//   makes a soft, neutral sound, because a tracker that scolds you is one you
//   start lying to.
//
//   Shield is not celebratory. Surviving an urge earns relief, not a fanfare —
//   a warm resolving tone rather than the bright arpeggio a level-up gets. The
//   same event should not sound like winning a prize.
//
// Everything is pentatonic, so two sounds that overlap cannot land on a
// dissonance.

const A = 440;
/** Semitones from A4 -> Hz. */
const hz = (n) => A * Math.pow(2, n / 12);

const N = {
  E3: hz(-17), A3: hz(-12), C4: hz(-9), D4: hz(-7), E4: hz(-5), G4: hz(-2),
  A4: hz(0), C5: hz(3), D5: hz(5), E5: hz(7), G5: hz(10), A5: hz(12),
  C6: hz(15), E6: hz(19), G6: hz(22),
};

/**
 * Each sound is a list of notes: when (seconds from the start), how long, the
 * pitch, and optionally a pitch to glide to. Data, so it can be rendered and
 * tested offline as well as played.
 */
export const SOUNDS = {
  // The core reward: two notes up, bright and very short.
  done:      [{ at: 0, dur: 0.15, f: N.E5, gain: 0.20 },
              { at: 0.06, dur: 0.22, f: N.A5, gain: 0.18 }],

  // The two-minute version still counts, so it still sings — just smaller.
  tiny:      [{ at: 0, dur: 0.18, f: N.D5, gain: 0.14 }],

  // Unticking something. Neutral and quiet on purpose: never a failure noise.
  undo:      [{ at: 0, dur: 0.16, f: N.A4, glide: N.E4, gain: 0.09, type: 'sine' }],

  // A planned rest day is a decision, not a miss.
  rest:      [{ at: 0, dur: 0.24, f: N.G4, gain: 0.10, type: 'sine' }],

  // Every seventh day on a habit.
  streak:    [{ at: 0, dur: 0.14, f: N.C5, gain: 0.16 },
              { at: 0.07, dur: 0.14, f: N.E5, gain: 0.16 },
              { at: 0.14, dur: 0.30, f: N.G5, gain: 0.18 }],

  // Claiming a quest tier — a coin, two notes struck together.
  claim:     [{ at: 0, dur: 0.30, f: N.G5, gain: 0.16 },
              { at: 0.005, dur: 0.34, f: N.C6, gain: 0.13 }],

  // Levelling up: the only genuine fanfare in the app.
  levelup:   [{ at: 0,    dur: 0.18, f: N.C5, gain: 0.16 },
              { at: 0.09, dur: 0.18, f: N.E5, gain: 0.16 },
              { at: 0.18, dur: 0.18, f: N.G5, gain: 0.17 },
              { at: 0.27, dur: 0.55, f: N.C6, gain: 0.19 },
              { at: 0.27, dur: 0.55, f: N.E6, gain: 0.10 }],

  // Everything due, done.
  dayDone:   [{ at: 0,    dur: 0.22, f: N.C5, gain: 0.15 },
              { at: 0,    dur: 0.22, f: N.E5, gain: 0.11 },
              { at: 0.11, dur: 0.50, f: N.G5, gain: 0.16 },
              { at: 0.11, dur: 0.50, f: N.C6, gain: 0.09 }],

  // Shield. Warm, low, resolving — relief, not a prize.
  relief:    [{ at: 0,    dur: 0.60, f: N.A3, gain: 0.16, type: 'sine' },
              { at: 0.12, dur: 0.60, f: N.E4, gain: 0.13, type: 'sine' },
              { at: 0.30, dur: 0.70, f: N.A4, gain: 0.10, type: 'sine' }],

  // Closing the day: descending, settling, nothing to do next.
  settle:    [{ at: 0,    dur: 0.40, f: N.G4, gain: 0.13, type: 'sine' },
              { at: 0.16, dur: 0.60, f: N.D4, gain: 0.12, type: 'sine' },
              { at: 0.34, dur: 0.80, f: N.C4, gain: 0.11, type: 'sine' }],

  // Coming back after a gap. Rising, but gentle — not a fanfare for a lapse.
  begin:     [{ at: 0,    dur: 0.30, f: N.D4, gain: 0.12, type: 'sine' },
              { at: 0.14, dur: 0.30, f: N.A4, gain: 0.12, type: 'sine' },
              { at: 0.28, dur: 0.55, f: N.D5, gain: 0.13, type: 'sine' }],

  // Writing in the ledger. One quiet note: acknowledgement, not applause.
  note:      [{ at: 0, dur: 0.20, f: N.D5, gain: 0.10, type: 'sine' }],

  // A refused action — the slot ceiling, a blocked add. Low and brief.
  deny:      [{ at: 0, dur: 0.16, f: N.E3, gain: 0.11, type: 'sine' },
              { at: 0.05, dur: 0.16, f: N.C4, glide: N.A3, gain: 0.07, type: 'sine' }],

  // Advancing the tour. Almost subliminal.
  tick:      [{ at: 0, dur: 0.06, f: N.G6, gain: 0.05 }],
};

/* ----------------------------------------------------------------- engine */

let ctx = null;
let master = null;
let enabled = true;
let unlocked = false;

/** Sound is a preference like haptics, and lives in the same settings block. */
export function setSound(on) { enabled = !!on; }
export function soundEnabled() { return enabled; }

/**
 * Browsers refuse to start an AudioContext outside a user gesture, so the first
 * tap anywhere creates it. Called from main.js on boot; harmless twice.
 */
export function initAudio() {
  if (unlocked) return;
  const start = () => {
    unlocked = true;
    try {
      context();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (_) { /* no audio on this device; everything else still works */ }
    document.removeEventListener('pointerdown', start);
    document.removeEventListener('keydown', start);
  };
  document.addEventListener('pointerdown', start, { once: false });
  document.addEventListener('keydown', start, { once: false });
}

function context() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  return ctx;
}

/**
 * Schedule one sound onto any context, real or offline.
 *
 * Exported so the sounds can be rendered and measured without a speaker —
 * an OfflineAudioContext runs this and gives back the samples.
 */
export function schedule(audioCtx, dest, spec, t0 = 0) {
  let end = t0;
  for (const n of spec) {
    const at = t0 + (n.at || 0);
    const dur = n.dur || 0.2;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = n.type || 'triangle';
    osc.frequency.setValueAtTime(n.f, at);
    if (n.glide) osc.frequency.exponentialRampToValueAtTime(n.glide, at + dur);

    // Exponential ramps rather than linear: gain has to stay above zero for
    // them, hence the tiny floor, and the decay sounds like a struck object
    // instead of a fade.
    const peak = n.gain ?? 0.15;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    end = Math.max(end, at + dur + 0.02);
  }
  return end;
}

/** Play a named sound. Silent and safe if audio is off or unavailable. */
export function sfx(name) {
  if (!enabled) return;
  const spec = SOUNDS[name];
  if (!spec) return;
  try {
    const c = context();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    schedule(c, master, spec, c.currentTime + 0.001);
  } catch (_) { /* never let a missing speaker break a habit tick */ }
}

/** Total length of a sound in seconds — used by the tests and nothing else. */
export function durationOf(name) {
  const spec = SOUNDS[name] || [];
  return spec.reduce((m, n) => Math.max(m, (n.at || 0) + (n.dur || 0.2) + 0.02), 0);
}

export const SOUND_NAMES = Object.keys(SOUNDS);
