// focus.js — the anti-procrastination screen.
//
// The premise: you do not have a discipline problem, you have a starting
// problem. So the primary button is two minutes long, the timer survives the
// app being closed, and finishing early still counts.

import { h, raw, actions, haptic, toast, xpBurst, sheet, qaRow } from '../ui/dom.js';
import { getState, mutate } from '../core/store.js';
import { uid, XP } from '../core/schema.js';
import { grantXp } from '../core/game.js';
import { evidenceCard } from '../ui/widgets.js';
import { todayKey, dayKey } from '../core/dates.js';
import { refresh } from '../core/router.js';
import { passageFor } from '../data/scripture.js';
import { passageCard } from '../ui/widgets.js';
import { icon } from '../ui/icons.js';
import { gateScreen, gateMount } from '../ui/gate.js';

const PRESETS = [
  { min: 2,  label: 'Just start', note: 'two minutes' },
  { min: 10, label: 'Short',      note: 'ten minutes' },
  { min: 25, label: 'Standard',   note: 'one pomodoro' },
  { min: 50, label: 'Deep',       note: 'a full block' },
];

let ticker = null;

/* ------------------------------------------------------------- session */

function active(state = getState()) { return state.focus.active || null; }

function remainingMs(session) {
  if (!session) return 0;
  const total = session.minutes * 60000;
  const elapsed = Date.now() - session.startedAt - (session.pausedMs || 0);
  return Math.max(0, total - elapsed);
}

function startSession(minutes, task = '') {
  mutate((s) => {
    s.focus.active = { id: uid('f'), minutes, task, startedAt: Date.now(), pausedMs: 0, pausedAt: null };
  });
  haptic([16, 40, 16]);
  refresh();
}

function endSession(completed) {
  const s = active();
  if (!s) return;
  const elapsedMin = Math.max(0, Math.round((Date.now() - s.startedAt - (s.pausedMs || 0)) / 60000));
  mutate((st) => {
    st.focus.sessions.push({
      id: s.id, task: s.task, minutes: completed ? s.minutes : elapsedMin,
      planned: s.minutes, completed, at: Date.now(),
    });
    if (st.focus.sessions.length > 800) st.focus.sessions = st.focus.sessions.slice(-800);
    st.focus.active = null;
  });

  if (completed) {
    const gained = Math.round(s.minutes * XP.focusPerMin);
    grantXp(gained, 'aql');
    haptic([20, 50, 20, 50, 60]);
    toast(`${s.minutes} minutes done · +${gained} XP`, { icon: icon('target'), tone: 'good' });
  } else if (elapsedMin >= 2) {
    // Stopping early after real work still pays. Punishing a short session
    // teaches you not to start at all, which is the actual problem.
    const gained = Math.round(elapsedMin * XP.focusPerMin);
    grantXp(gained, 'aql');
    toast(`${elapsedMin} minutes still counted · +${gained} XP`, { tone: 'good' });
  } else {
    toast('Stopped. No penalty — come back to it.', {});
  }
  refresh();
}

/* -------------------------------------------------------------- screen */

export const focusScreen = {
  render() {
    // Optional module: it holds part of the same XP budget the habits draw on,
    // so it has to be switched on deliberately. See core/unlocks.js.
    const gate = gateScreen('focus', { back: '#/today', backLabel: 'Today' });
    if (gate) return gate;

    const state = getState();
    const s = active(state);
    const todaysKey = todayKey();
    const today = state.focus.sessions.filter((x) => dayKey(new Date(x.at)) === todaysKey);
    const minsToday = today.reduce((sum, x) => sum + (x.minutes || 0), 0);
    const tasks = state.focus.tasks.filter((t) => !t.done);
    const doneTasks = state.focus.tasks.filter((t) => t.done).slice(-3);

    if (s) return runningView(s, minsToday);

    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/today" class="muted" style="font-size:.85rem">‹ Today</a>
          <div class="eyebrow" style="margin-top:8px">Focus</div>
          <h1>Start before you feel like it</h1>
        </header>

        <div class="stack">
          <div class="card card--accent" style="padding:12px 14px">
            ${raw(qaRow('Waiting to feel motivated is the mistake',
              'Action comes first and the motivation shows up partway through — that is behavioural activation, and it holds up in trials against full cognitive therapy for depression.'))}
          </div>

          <button class="btn btn--primary btn--lg btn--block" data-act="start2" style="min-height:64px;font-size:1.08rem">
            ${icon('bolt')} Just start — 2 minutes
          </button>
          <p class="muted center" style="font-size:.79rem;margin:-4px 0 0">
            You are allowed to stop at two minutes. You almost certainly will not.
          </p>

          <div class="section-title"><span>Or pick a block</span></div>
          <div class="row" style="gap:8px">
            ${PRESETS.slice(1).map((p) => raw(h`
              <button class="btn btn--ghost grow" data-act="start" data-min="${p.min}" style="flex-direction:column;gap:2px;min-height:64px">
                <span style="font-weight:750;font-size:1.1rem">${p.min}</span>
                <span class="muted" style="font-size:.68rem">${p.label}</span>
              </button>`))}
          </div>

          <div class="statgrid" style="margin-top:6px">
            <div class="stat"><div class="stat__n">${minsToday}</div><div class="stat__l">min today</div></div>
            <div class="stat"><div class="stat__n">${today.filter((x) => x.completed).length}</div><div class="stat__l">blocks today</div></div>
            <div class="stat"><div class="stat__n">${state.focus.sessions.filter((x) => x.completed).length}</div><div class="stat__l">all time</div></div>
          </div>

          <div class="section-title"><span>What you are avoiding</span>
            <button class="btn btn--ghost btn--sm" data-act="addtask">Add</button></div>
          ${tasks.length ? raw(h`
            <div>${tasks.map((t) => raw(h`
              <div class="task">
                <button class="habitrow__check" data-act="donetask" data-id="${t.id}" aria-label="Complete">${icon('check')}</button>
                <span class="task__title">${t.title}</span>
                <button class="btn btn--ghost btn--sm" data-act="starttask" data-id="${t.id}">Start</button>
              </div>`))}</div>`) : raw(h`
            <div class="card" style="padding:12px 14px">
              ${raw(qaRow('Write the one thing you keep circling',
                'Naming it is most of the fight — an unnamed task stays vague, and vague tasks cannot be started.'))}
            </div>`)}

          ${doneTasks.length ? raw(h`
            <div class="section-title"><span>Recently cleared</span></div>
            <div>${doneTasks.map((t) => raw(h`<div class="task is-done"><span class="task__title">${t.title}</span></div>`))}</div>`) : raw('')}

          <div class="section-title"><span>When you cannot start at all</span></div>
          <button class="listrow" data-act="unstick" style="width:100%;text-align:left">
            <span class="listrow__icon">${icon('box')}</span>
            <span class="grow">
              <span style="display:block;font-weight:620">Unstick me</span>
              <span class="muted" style="font-size:.78rem">Four questions that shrink it to something startable</span>
            </span>
            <span class="listrow__chev">›</span>
          </button>

          ${raw(evidenceCard('zeigarnik', { full: true }))}
          ${raw(evidenceCard('behaviouralActivation', { full: true }))}
        </div>
      </div>`;
  },

  mount(root) {
    if (gateMount(root)) return;
    actions(root, {
      start2:    () => startSession(2),
      start:     (el, ds) => startSession(Number(ds.min)),
      starttask: (el, ds) => {
        const t = getState().focus.tasks.find((x) => x.id === ds.id);
        startSession(25, t?.title || '');
      },
      addtask:   () => openTaskSheet(),
      donetask:  (el, ds) => {
        mutate((s) => {
          const t = s.focus.tasks.find((x) => x.id === ds.id);
          if (t) { t.done = true; t.doneAt = Date.now(); }
        });
        haptic([14, 30, 20]);
        grantXp(10, 'waqt');
        xpBurst(10, el);
        refresh();
      },
      unstick:   () => openUnstick(),
      pause:     () => togglePause(),
      stop:      () => endSession(false),
      finish:    () => endSession(true),
      extend:    () => { mutate((s) => { s.focus.active.minutes += 10; }); haptic(12); refresh(); },
    });

    startTicker(root);
  },

  unmount() { stopTicker(); },
};

/* ------------------------------------------------------------- running */

function runningView(s, minsToday) {
  const paused = !!s.pausedAt;
  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">Focus · in progress</div>
        <h1>${s.task || 'Working'}</h1>
      </header>

      <div class="card focusdial">
        <div class="focusdial__time" id="focus-clock">--:--</div>
        <div class="focusdial__label">${s.minutes}-minute block${paused ? ' · paused' : ''}</div>
      </div>

      <div class="row" style="gap:8px;margin-top:14px">
        <button class="btn btn--ghost grow" data-act="pause">${paused ? 'Resume' : 'Pause'}</button>
        <button class="btn btn--ghost grow" data-act="extend">+10 min</button>
      </div>

      <div class="stack" style="margin-top:12px">
        <button class="btn btn--primary btn--block" data-act="finish">Finish now</button>
        <button class="btn btn--ghost btn--block" data-act="stop">Stop — count what I did</button>
      </div>

      <div class="card" style="margin-top:18px;padding:12px 14px">
        ${raw(qaRow('Phone face-down',
          `The only rule for the next ${s.minutes} minutes is that you do not switch to something else. Staring at the wall is allowed. Opening a tab is not.`))}
      </div>

      <div class="card" style="margin-top:12px">${raw(passageCard(passageFor('stalling', s.id), {}))}</div>

      <p class="muted center" style="font-size:.78rem;margin-top:14px">${minsToday} minutes focused today</p>
    </div>`;
}

function togglePause() {
  mutate((s) => {
    const a = s.focus.active;
    if (!a) return false;
    if (a.pausedAt) { a.pausedMs = (a.pausedMs || 0) + (Date.now() - a.pausedAt); a.pausedAt = null; }
    else a.pausedAt = Date.now();
  });
  haptic(10);
  refresh();
}

/** The clock updates in place, so the whole screen is not re-rendered each second. */
function startTicker(root) {
  stopTicker();
  const el = root.querySelector('#focus-clock');
  if (!el) return;
  const paint = () => {
    const s = active();
    if (!s) { stopTicker(); return; }
    if (s.pausedAt) return;
    const ms = remainingMs(s);
    const secs = Math.ceil(ms / 1000);
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    if (ms <= 0) { stopTicker(); haptic([40, 80, 40, 80, 120]); endSession(true); }
  };
  paint();
  ticker = setInterval(paint, 1000);
}

function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

/* --------------------------------------------------------------- sheets */

function openTaskSheet() {
  sheet({
    title: 'The thing you are avoiding',
    body: h`
      <div class="stack">
        <label class="field">
          <span>Write it as a physical action</span>
          <input type="text" id="tk-title" placeholder="Open the assignment file and write the first paragraph">
          <span class="hint">"Study" is not startable. "Open the file and write one paragraph" is.</span>
        </label>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Add it</button>`,
    onMount: (el, close) => {
      const input = el.querySelector('#tk-title');
      setTimeout(() => input.focus(), 250);
      const save = () => {
        const title = input.value.trim();
        if (!title) return;
        mutate((s) => { s.focus.tasks.push({ id: uid('t'), title, done: false, createdAt: Date.now() }); });
        close();
        refresh();
      };
      el.addEventListener('click', (ev) => { if (ev.target.closest('[data-save]')) save(); });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
    },
  });
}

/**
 * Four questions, in the order that actually unsticks a stalled task: shrink
 * the scope, name the physical first move, remove the obstacle, then commit to
 * a start time. That last step is the implementation intention.
 */
function openUnstick() {
  sheet({
    title: 'Unstick me',
    size: 'full',
    body: h`
      <div class="stack">
        <label class="field">
          <span>1 · What is the task, in plain words?</span>
          <input type="text" id="us-1" placeholder="Finish the report">
        </label>
        <label class="field">
          <span>2 · What is the smallest physical first move?</span>
          <input type="text" id="us-2" placeholder="Open the document and read the last paragraph I wrote">
          <span class="hint">It must be something a camera could film you doing.</span>
        </label>
        <label class="field">
          <span>3 · What is actually in the way?</span>
          <input type="text" id="us-3" placeholder="I do not know how to start section 3, so I avoid the whole file">
          <span class="hint">Usually the blocker is one specific unknown, not the whole task.</span>
        </label>
        <label class="field">
          <span>4 · When and where do you start? Be exact.</span>
          <input type="text" id="us-4" placeholder="Right after Asr, at the desk, phone in the kitchen">
        </label>
        ${raw(evidenceCard('implementationIntentions', { full: true }))}
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Save it and start two minutes</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        if (!ev.target.closest('[data-save]')) return;
        const first = el.querySelector('#us-2').value.trim();
        const task = el.querySelector('#us-1').value.trim();
        const when = el.querySelector('#us-4').value.trim();
        if (task) {
          mutate((s) => {
            s.focus.tasks.push({
              id: uid('t'),
              title: first || task,
              plan: when, blocker: el.querySelector('#us-3').value.trim(),
              done: false, createdAt: Date.now(),
            });
          });
        }
        close();
        startSession(2, first || task || '');
      });
    },
  });
}
