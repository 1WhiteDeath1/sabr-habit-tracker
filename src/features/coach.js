// coach.js — the second half of the tour: Noor on the real screen.
//
// The card tour explains the ideas. This points at the actual controls, in
// order, on the Today screen the user is about to live in. Cards tell you a
// habit row exists; this puts a ring around the one in front of you.
//
// It is a DOM overlay rather than a route, because the whole point is that the
// real app is underneath it. Nothing here mutates app state except the "seen"
// flag, and every step is skipped rather than faked if its target is missing —
// a user with no habits yet must not be shown a ring around empty space.

import { getState, mutate } from '../core/store.js';
import { haptic, toast } from '../ui/dom.js';
import { go } from '../core/router.js';
import { noor } from './tutorial.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';

/* Targets are looked up at the moment the step runs, never cached: the screen
   re-renders between steps and a held reference would point at a dead node. */
const STEPS = [
  {
    find: () => document.getElementById('topbar'),
    title: 'Points and level',
    lines: ['These live up here, on every screen.', 'They only ever go up.'],
    place: 'below',
  },
  {
    find: () => document.querySelector('#outlet [data-coach="ring"]'),
    title: 'Your day so far',
    lines: ['This ring fills as you finish things.', 'It starts empty every morning. That is normal.'],
    place: 'below',
  },
  {
    find: () => document.querySelector('#outlet .habitrow'),
    title: 'This is a habit',
    lines: ['Tap the circle to mark it done.', 'Tap the name for the small version and the reason.'],
    place: 'below',
  },
  {
    find: () => document.querySelector('#outlet .more'),
    title: 'Everything else',
    lines: ['Classes, homework, and the parts you open later.', 'They stay closed so this screen stays short.'],
    place: 'above',
  },
  {
    find: () => document.querySelector('#nav [data-tab="quests"]'),
    title: 'Quests',
    lines: ['Long goals. Seven days, then twenty-one, then forty.'],
    place: 'above',
  },
  {
    find: () => document.querySelector('#nav .nav__disc'),
    title: 'This one is you',
    lines: ['Your level, your record, and your life in weeks.', 'The big round button in the middle.'],
    place: 'above',
  },
  {
    find: () => document.querySelector('#nav [data-tab="uni"]'),
    title: 'Uni',
    lines: ['Your classes, your attendance and your marks.'],
    place: 'above',
  },
  {
    find: () => document.querySelector('#nav [data-tab="shield"]'),
    title: 'Shield',
    lines: ['For a habit you are trying to stop.', 'Open it before the urge, not after.'],
    place: 'above',
  },
];

/**
 * Run `fn` once the next paint has landed.
 *
 * requestAnimationFrame does not fire at all while the tab is hidden, and the
 * tour can legitimately be started in that state — a backgrounded PWA restoring
 * on launch, for one. Without the timeout the overlay would simply never appear
 * and there would be nothing on screen to say why.
 */
function afterPaint(fn) {
  let ran = false;
  const run = () => { if (ran) return; ran = true; fn(); };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 60);
}

const PAD = 8;          // breathing room around the ring
const GAP = 14;         // between the ring and the bubble
let host = null;
let index = 0;
let queue = [];
let onReflow = null;

/* -------------------------------------------------------------- lifecycle */

/** Runs the overlay tour on Today. Safe to call twice — the second call wins. */
export function startCoach() {
  stopCoach();
  go('today');
  // One paint for the router to lay Today out before anything is measured.
  afterPaint(() => {
    queue = STEPS.filter((s) => s.find());
    if (!queue.length) { finish({ skipped: true, quiet: true }); return; }
    index = 0;
    build();
    show();
  });
}

export function stopCoach() {
  if (onReflow) {
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
    onReflow = null;
  }
  host?.remove();
  host = null;
  document.body.classList.remove('is-coached');
}

function build() {
  host = document.createElement('div');
  host.className = 'coach';
  host.innerHTML = `
    <div class="coach__hole"></div>
    <div class="coach__bubble">
      <div class="coach__noor">${noor('happy')}</div>
      <div class="coach__text">
        <h3></h3>
        <div class="coach__lines"></div>
      </div>
      <div class="coach__foot">
        <button class="btn btn--ghost btn--sm" data-coach-act="skip">Skip</button>
        <span class="coach__count"></span>
        <button class="btn btn--primary btn--sm" data-coach-act="next">Next</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  document.body.classList.add('is-coached');

  host.addEventListener('click', (ev) => {
    const act = ev.target.closest('[data-coach-act]')?.dataset.coachAct;
    if (act === 'next') { sfx('tick'); haptic(9); advance(); }
    if (act === 'skip') finish({ skipped: true });
  });

  // The bar and the ring are positioned in viewport coordinates, so anything
  // that moves the page has to move them too.
  onReflow = () => position();
  window.addEventListener('resize', onReflow);
  window.addEventListener('scroll', onReflow, true);
}

function advance() {
  if (index >= queue.length - 1) return finish({ skipped: false });
  index += 1;
  show();
}

function finish({ skipped, quiet = false }) {
  stopCoach();
  mutate((s) => { s.profile.coachDone = true; });
  if (quiet) return;
  haptic([18, 40, 18]);
  toast(skipped ? 'Fine. It is in Settings when you want it.' : 'That is the whole app. Go and do the first one.',
    { icon: icon('lamp'), tone: 'good' });
}

/* ---------------------------------------------------------------- drawing */

function show() {
  const step = queue[index];
  host.querySelector('h3').textContent = step.title;
  host.querySelector('.coach__lines').innerHTML =
    step.lines.map((l) => `<p>${escapeText(l)}</p>`).join('');
  host.querySelector('.coach__count').textContent = `${index + 1} / ${queue.length}`;
  host.querySelector('[data-coach-act="next"]').textContent =
    index === queue.length - 1 ? 'Done' : 'Next';

  const target = step.find();
  // Bring it into view first, then measure once the scroll has settled.
  target?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
  afterPaint(() => position());
}

function position() {
  if (!host) return;
  const step = queue[index];
  const target = step?.find();
  const hole = host.querySelector('.coach__hole');
  const bubble = host.querySelector('.coach__bubble');
  if (!target) return;

  const r = target.getBoundingClientRect();
  const top = Math.max(4, r.top - PAD);
  const left = Math.max(4, r.left - PAD);
  const width = Math.min(window.innerWidth - left - 4, r.width + PAD * 2);
  const height = Math.min(window.innerHeight - top - 4, r.height + PAD * 2);

  hole.style.top = `${top}px`;
  hole.style.left = `${left}px`;
  hole.style.width = `${width}px`;
  hole.style.height = `${height}px`;

  // Prefer the side the step asks for, but never off the top or bottom.
  const bh = bubble.offsetHeight || 190;
  const below = top + height + GAP;
  const above = top - GAP - bh;
  let y;
  let arrow;
  if (step.place === 'above' && above >= 8) { y = above; arrow = 'down'; }
  else if (below + bh <= window.innerHeight - 8) { y = below; arrow = 'up'; }
  else if (above >= 8) { y = above; arrow = 'down'; }
  else { y = Math.max(8, (window.innerHeight - bh) / 2); arrow = 'none'; }

  bubble.style.top = `${Math.round(y)}px`;
  bubble.dataset.arrow = arrow;

  // Point the arrow at the middle of the ring, clamped inside the bubble.
  const centre = left + width / 2;
  const bx = bubble.getBoundingClientRect();
  const offset = Math.max(22, Math.min(bx.width - 22, centre - bx.left));
  bubble.style.setProperty('--arrow-x', `${Math.round(offset)}px`);
}

function escapeText(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** True when the card tour is done but the on-screen pass has not run. */
export function coachPending(state = getState()) {
  return !!state.profile.tutorialDone && !state.profile.coachDone;
}
