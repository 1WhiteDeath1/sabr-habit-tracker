// tutorial.js — the guided tour, run once after onboarding.
//
// Noor is a lamp. She is the only voice in the app that speaks in short, plain
// sentences: everywhere else the copy is deliberately blunt, which is right for
// someone who already knows what the screen does and wrong for someone seeing
// it for the first time. Short words, one idea per line, no idioms.
//
// The tour is skippable from the first step and repeatable from Settings, so it
// never becomes a wall between a returning user and their habits.

import { h, raw, actions, haptic, toast } from '../ui/dom.js';
import { getState, mutate } from '../core/store.js';
import { go, refresh } from '../core/router.js';
import { startCoach } from './coach.js';
import { icon } from '../ui/icons.js';

let step = 0;

/* ---------------------------------------------------------------- mascot */

/** Noor, drawn once. `mood` only changes the face, so the body stays put. */
export function noor(mood = 'happy') {
  const eyes = mood === 'wink'
    ? `<circle cx="51" cy="70" r="5" fill="var(--noor-ink)"/>
       <path d="M64 70h10" stroke="var(--noor-ink)" stroke-width="4.5" stroke-linecap="round" fill="none"/>`
    : `<circle cx="51" cy="70" r="5" fill="var(--noor-ink)"/>
       <circle cx="69" cy="70" r="5" fill="var(--noor-ink)"/>`;
  const mouth = mood === 'oh'
    ? `<ellipse cx="60" cy="88" rx="6" ry="7" fill="var(--noor-ink)"/>`
    : `<path d="M50 85a12 12 0 0 0 20 0" stroke="var(--noor-ink)" stroke-width="4.5"
             stroke-linecap="round" fill="none"/>`;

  return `
    <svg class="noor" viewBox="0 0 120 142" role="img" aria-label="Noor the lamp">
      <path d="M44 27a16 16 0 0 1 32 0" fill="none" stroke="var(--noor-metal)"
            stroke-width="5" stroke-linecap="round"/>
      <rect x="33" y="26" width="54" height="13" rx="6.5" fill="var(--noor-metal)"/>
      <path d="M41 41h38a8 8 0 0 1 8 8v43a27 27 0 0 1-27 27 27 27 0 0 1-27-27V49a8 8 0 0 1 8-8Z"
            fill="var(--noor-glass)" stroke="var(--noor-metal)" stroke-width="5" stroke-linejoin="round"/>
      <rect x="37" y="119" width="46" height="13" rx="6.5" fill="var(--noor-metal)"/>
      ${eyes}
      ${mouth}
    </svg>`;
}

/* ----------------------------------------------------------------- steps */

/* Every line is one short sentence. If a line needs a comma to survive, it is
   two lines. */
const STEPS = [
  {
    mood: 'happy',
    title: 'Hi, I am Noor',
    lines: [
      'I am a lamp. I live in this app.',
      'I will show you what each part does.',
      'It takes about one minute.',
    ],
  },
  {
    mood: 'happy',
    title: 'Today is your list',
    lines: [
      'The Today screen shows what you do today.',
      'Tap the circle when you finish a thing.',
      'That is the whole app, really.',
    ],
    art: demoRow(),
  },
  {
    mood: 'happy',
    title: 'Small still counts',
    lines: [
      'Some days are bad. That is normal.',
      'On a bad day, do the tiny version.',
      'Two minutes counts. You still get points.',
    ],
  },
  {
    mood: 'oh',
    title: 'Never miss two days',
    lines: [
      'Missing one day does not break anything.',
      'Missing two days in a row is what hurts.',
      'So if you missed yesterday, do the tiny version today.',
    ],
  },
  {
    mood: 'wink',
    title: 'The round button is you',
    lines: [
      'Look at the bar at the bottom.',
      'The big round button in the middle is your page.',
      'Your level, your habits, and your life in weeks.',
    ],
    art: demoNav(),
  },
  {
    mood: 'happy',
    title: 'Quests are long goals',
    lines: [
      'Keep a habit for 7 days. Then 21. Then 40.',
      'Each one gives you points.',
      'You never lose points here. Not ever.',
    ],
  },
  {
    mood: 'happy',
    title: 'Shield is for hard habits',
    lines: [
      'Trying to stop something? This part helps.',
      'Press the big button when you feel the urge.',
      'It waits with you. It never calls you bad.',
    ],
  },
  {
    mood: 'happy',
    title: 'Uni keeps your classes',
    lines: [
      'Add your courses and your class times.',
      'Mark yourself present or absent each day.',
      'It tells you how many classes you can still miss.',
    ],
  },
  {
    mood: 'happy',
    title: 'Points open new parts',
    lines: [
      'Every habit you finish gives you points.',
      'Points raise your level, and levels open new parts of the app.',
      'A focus timer. A night check. More habit slots.',
    ],
  },
  {
    mood: 'wink',
    title: 'Now the real screen',
    lines: [
      'Start with two or three habits. Not ten.',
      'Small things, done often, change a person.',
      'Come with me. I will point at each part.',
    ],
    last: true,
  },
];

/* Tiny, fake examples. They are pictures, not live widgets — a real habit row
   here would be tappable and would log a habit that does not exist. */
function demoRow() {
  return `
    <div class="tut__art">
      <div class="tutrow">
        <span class="tutrow__check">✓</span>
        <span class="tutrow__title">Pray Fajr</span>
      </div>
      <div class="tutrow is-done">
        <span class="tutrow__check">✓</span>
        <span class="tutrow__title">Read 10 minutes</span>
      </div>
    </div>`;
}

function demoNav() {
  return `
    <div class="tut__art">
      <div class="tutnav">
        <i></i><i></i>
        <span class="tutnav__disc"></span>
        <i></i><i></i>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------- screen */

export const tutorialScreen = {
  render() {
    const s = STEPS[step];
    return h`
      <div class="screen tut">
        <div class="obsteps">
          ${STEPS.map((_, i) => raw(`<i class="${i <= step ? 'is-on' : ''}"></i>`))}
        </div>

        <div class="tut__body">
          <div class="tut__noor">${raw(noor(s.mood))}</div>
          <div class="tut__bubble">
            <h2>${s.title}</h2>
            ${s.lines.map((line) => raw(h`<p>${line}</p>`))}
          </div>
          ${s.art ? raw(s.art) : raw('')}
        </div>

        <div class="tut__foot">
          <button class="btn btn--primary btn--lg btn--block" data-act="next">
            ${s.last ? 'Start' : 'Next'}
          </button>
          ${s.last ? raw('') : raw(h`
            <div class="row" style="gap:8px">
              ${step > 0 ? raw(h`<button class="btn btn--ghost btn--sm grow" data-act="back">Back</button>`) : raw('')}
              <button class="btn btn--ghost btn--sm grow" data-act="skip">Skip the tour</button>
            </div>`)}
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      next: () => {
        haptic(10);
        if (step >= STEPS.length - 1) return done({ skipped: false });
        step += 1;
        refresh();
      },
      back: () => { step = Math.max(0, step - 1); refresh(); },
      skip: () => done({ skipped: true }),
    });
  },
};

function done({ skipped }) {
  step = 0;
  mutate((s) => { s.profile.tutorialDone = true; });
  haptic([18, 40, 18]);
  if (skipped) {
    // Skipping the cards skips the on-screen pass too. Someone who wants out
    // wants out of both halves, not the second one a moment later.
    mutate((s) => { s.profile.coachDone = true; });
    toast('Tour skipped. It is in Settings if you want it.', { icon: icon('lamp') });
    go('today');
    return;
  }
  startCoach();
}

/** Settings uses this to send you back through both halves of the tour. */
export function restartTutorial() {
  step = 0;
  mutate((s) => { s.profile.tutorialDone = false; s.profile.coachDone = false; });
  go('tutorial');
}

/** True when someone has finished onboarding but has not seen the tour yet. */
export function tutorialPending(state = getState()) {
  return !!state.profile.onboarded && !state.profile.tutorialDone;
}
