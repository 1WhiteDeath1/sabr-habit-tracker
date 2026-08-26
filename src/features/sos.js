// sos.js — the urge-surfing screen. The single most important 15 minutes in
// this app, so it gets a dedicated full-screen mode with nothing else on it.
//
// The structure follows relapse-prevention practice rather than motivational
// slogans: name the state (HALT), change the physical context, pace the breath,
// watch the urge as a wave with a peak and a tail, and log the outcome honestly
// either way. Slipping is logged without penalty — see core/recovery.js.

import { h, raw, haptic, toast, sheet, confirmSheet } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { logUrge, logEpisode, TRIGGERS, markPlanUsed } from '../core/recovery.js';
import { passageFor, DUAS } from '../data/scripture.js';
import { passageCard, evidenceCard } from '../ui/widgets.js';
import { refresh } from '../core/router.js';
import { humanDuration } from '../core/dates.js';
import { icon } from '../ui/icons.js';
import { playClip } from '../core/voice.js';
import { sfx } from '../core/audio.js';

/** Prompts rotate every 30s so the screen keeps giving you something to do. */
const GROUNDING = [
  'Stand up. Walk out of this room. Do it before you finish reading this line.',
  'Make wudu. Cold water on your face and arms. It interrupts the loop physically.',
  'Name five things you can see. Four you can hear. Three you can touch.',
  'This feeling has an end. It has always had an end. You have simply never waited for it.',
  'Text the person who knows. One line. You do not have to explain.',
  'Go outside. Even the doorstep. Change what your eyes are pointed at.',
  'Ask honestly: am I hungry, angry, lonely, or tired? Deal with that instead.',
  'You have survived this exact feeling before. Every single time, without exception.',
  'Two rak‘ah. Right now. Even if you feel like a hypocrite doing it — especially then.',
  'The version of you that wants this in ten minutes will thank you. The one that wants it now will not remember.',
];

const HALT_OPTIONS = [
  { id: 'hungry',   label: 'Hungry',  fix: 'Eat something real first. Low blood sugar is not a moral failure.' },
  { id: 'angry',    label: 'Angry',   fix: 'Move it out of your body — walk fast, or one hard set of push-ups.' },
  { id: 'lonely',   label: 'Lonely',  fix: 'Call someone. Anyone. This is the trigger with the highest hit rate.' },
  { id: 'tired',    label: 'Tired',   fix: 'Sleep is the answer, not the reward afterwards. Go to bed now.' },
];

let session = null;

export function openSos() {
  if (session) return;

  const state = getState();
  const host = document.createElement('div');
  host.className = 'sos';
  document.body.appendChild(host);
  document.body.classList.add('is-locked');

  session = {
    host,
    startedAt: Date.now(),
    intensity: 3,
    halt: new Set(),
    triggers: new Set(),
    promptIndex: 0,
    tick: null,
    breathPhase: 0,
    breathTimer: null,
  };

  host.innerHTML = renderSos(state);
  bind(host);
  startTimers(host);
  haptic([20, 60, 20]);
}

function renderSos(state) {
  const passage = passageFor('urge', String(Date.now() >> 20));
  const dua = DUAS[0];
  const plans = state.recovery.plans.slice(0, 3);

  return h`
    <div class="row-between" style="margin-bottom:4px">
      <div>
        <div class="muted" style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700">Riding it out</div>
        <h2 style="margin-top:2px">This is a wave.</h2>
      </div>
      <button class="iconbtn" data-sos="minimise" aria-label="Close">&times;</button>
    </div>

    <div class="sos__wave">
      ${raw(waveSvg())}
      <div style="position:absolute;inset:0;display:grid;place-items:center">
        <div>
          <div class="sos__timer" id="sos-timer">0:00</div>
          <div class="center muted" style="font-size:.78rem;margin-top:2px">most urges crest and fall inside 20 minutes</div>
        </div>
      </div>
    </div>

    <div class="breather" id="sos-breather">breathe in</div>

    <div class="card" style="margin-bottom:12px">
      <div id="sos-prompt" style="font-weight:600;line-height:1.55">${GROUNDING[0]}</div>
    </div>

    <div class="section-title"><span>What state are you actually in?</span></div>
    <div class="row wrap" style="gap:7px;margin-bottom:6px">
      ${HALT_OPTIONS.map((o) => raw(h`<button class="chip" data-halt="${o.id}">${o.label}</button>`))}
    </div>
    <div id="sos-halt-fix" class="muted" style="font-size:.83rem;min-height:1.2em;line-height:1.5"></div>

    ${plans.length ? raw(h`
      <div class="section-title"><span>Your if–then plans</span></div>
      <div class="stack-sm">
        ${plans.map((p) => raw(h`
          <button class="card" data-plan="${p.id}" style="width:100%;text-align:left;cursor:pointer">
            <div class="muted" style="font-size:.74rem">IF ${p.trigger}</div>
            <div style="font-weight:620;margin-top:3px">THEN ${p.thenDo}</div>
          </button>`))}
      </div>`) : raw('')}

    ${raw(whyCard(state))}

    <div class="section-title"><span>Hold on to this</span></div>
    <div class="card">${raw(passageCard(passage, { state }))}</div>

    <div class="card" style="margin-top:10px">
      <div class="muted" style="font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;margin-bottom:6px">${dua.label}</div>
      ${state.settings.arabic ? raw(h`<div class="ayah__ar">${dua.ar}</div>`) : raw('')}
      <div class="ayah__en">${dua.en}</div>
      <div class="ayah__ref">${dua.tr} · ${dua.ref}</div>
    </div>

    <div style="margin-top:16px">${raw(evidenceCard('urgeSurfing', { full: true }))}</div>

    <div class="stack" style="margin-top:18px">
      <button class="btn btn--primary btn--lg btn--block" data-sos="survived">I made it through</button>
      <button class="btn btn--ghost btn--block" data-sos="slipped">I slipped — log it honestly</button>
      <p class="muted center" style="font-size:.76rem;margin:2px 0 0">
        Logging a slip earns XP and never resets your lifetime total. You cannot lose progress here by being honest.
      </p>
    </div>`;
}

/** A slow-drifting wave, drawn once and animated in CSS. */
/**
 * The two lines you wrote when you were calm, read back when you are not.
 *
 * `profile.why` has been collected since the first version of this app and was
 * never once displayed — written down and buried. This is the moment it was
 * described for: "the one paragraph read back on hard days".
 *
 * Both lines are optional and neither is invented. An empty card would be worse
 * than none, so nothing renders until there is something of yours to render.
 */
function whyCard(state) {
  const { why, forWhom, hasVoice } = state.profile;
  if (!why && !forWhom && !hasVoice) return '';

  return h`
    <div class="card whycard">
      <div class="whycard__label">${icon('hands', { size: 15 })} Why you started</div>
      ${hasVoice ? raw(h`
        <button class="voicebtn" data-act="playvoice">
          ${icon('lamp', { size: 19 })}
          <span class="grow">Hear yourself say it</span>
          <span class="voicebtn__hint">20 seconds</span>
        </button>`) : raw('')}
      ${forWhom ? raw(h`<p class="whycard__for">${forWhom}</p>`) : raw('')}
      ${why ? raw(h`<p class="whycard__why">${why}</p>`) : raw('')}
      <p class="whycard__note">
        You wrote this when you were thinking clearly. That version of you knew
        something this minute does not.
      </p>
    </div>`;
}

function waveSvg() {
  const path = 'M0,60 C40,60 60,14 100,14 C140,14 160,60 200,60 C240,60 260,14 300,14 C340,14 360,60 400,60 L400,120 L0,120 Z';
  return `
    <svg viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".34"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g style="animation:drift 9s linear infinite">
        <path d="${path}" fill="url(#wg)"/>
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-opacity=".5" stroke-width="1.5"/>
      </g>
    </svg>`;
}

function startTimers(host) {
  const timerEl = host.querySelector('#sos-timer');
  const promptEl = host.querySelector('#sos-prompt');
  const breather = host.querySelector('#sos-breather');

  session.tick = setInterval(() => {
    const secs = Math.floor((Date.now() - session.startedAt) / 1000);
    timerEl.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const idx = Math.floor(secs / 30) % GROUNDING.length;
    if (idx !== session.promptIndex) {
      session.promptIndex = idx;
      promptEl.style.opacity = '0';
      setTimeout(() => { promptEl.textContent = GROUNDING[idx]; promptEl.style.opacity = '1'; }, 200);
    }
    // A quiet acknowledgement at the point most urges have already peaked.
    if (secs === 15 * 60) { haptic([30, 60, 30]); toast('Fifteen minutes. It is already weaker than it was.', { tone: 'good' }); }
  }, 1000);

  // Box breathing: 4 in, 4 hold, 4 out, 4 hold.
  const phases = [
    { label: 'breathe in', cls: 'is-in' },
    { label: 'hold', cls: 'is-in' },
    { label: 'breathe out', cls: 'is-out' },
    { label: 'hold', cls: 'is-out' },
  ];
  const step = () => {
    const p = phases[session.breathPhase % phases.length];
    breather.textContent = p.label;
    breather.classList.remove('is-in', 'is-out');
    breather.classList.add(p.cls);
    session.breathPhase += 1;
  };
  step();
  session.breathTimer = setInterval(step, 4000);
}

function bind(host) {
  host.addEventListener('click', async (ev) => {
    const halt = ev.target.closest('[data-halt]');
    if (halt) {
      const id = halt.dataset.halt;
      const on = session.halt.has(id);
      if (on) session.halt.delete(id); else session.halt.add(id);
      halt.classList.toggle('is-on', !on);
      const fixes = HALT_OPTIONS.filter((o) => session.halt.has(o.id)).map((o) => o.fix);
      host.querySelector('#sos-halt-fix').textContent = fixes.join(' ');
      haptic(8);
      return;
    }

    const plan = ev.target.closest('[data-plan]');
    if (plan) { markPlanUsed(plan.dataset.plan); haptic(12); toast('Good. Go and do it now.', { tone: 'good' }); return; }
    if (ev.target.closest('[data-act="playvoice"]')) {
      // The recording carries the tone the written line cannot. Failing to play
      // is silent on purpose: a broken clip must not become another obstacle.
      haptic(10);
      playClip();
      return;
    }

    const act = ev.target.closest('[data-sos]')?.dataset.sos;
    if (!act) return;

    if (act === 'minimise') {
      const ok = await confirmSheet({
        title: 'Leave the SOS screen?',
        message: 'You have been here ' + humanDuration(Date.now() - session.startedAt) + '. Nothing is logged unless you tell it what happened. Leaving now records nothing at all.',
        confirmLabel: 'Leave without logging',
      });
      if (ok) closeSos();
      return;
    }

    if (act === 'survived') { finish(true); return; }
    if (act === 'slipped')  { finish(false); return; }
  });
}

function finish(survived) {
  const durationSec = Math.floor((Date.now() - session.startedAt) / 1000);
  const haltTriggers = Array.from(session.halt);
  closeSos();

  if (survived) {
    logUrge({ intensity: 3, durationSec, survived: true, triggers: haltTriggers });
    sfx('relief');
    haptic([20, 40, 20, 40, 60]);
    toast(`Outlasted it — ${Math.max(1, Math.round(durationSec / 60))} min. +45 XP`, { icon: icon('wave'), tone: 'good' });
    refresh();
    return;
  }
  // A slip opens the recovery flow, not a scolding.
  logUrge({ intensity: 5, durationSec, survived: false, triggers: haltTriggers });
  openRelapseFlow(haltTriggers);
}

export function closeSos() {
  if (!session) return;
  clearInterval(session.tick);
  clearInterval(session.breathTimer);
  session.host.remove();
  document.body.classList.remove('is-locked');
  session = null;
}

/* ------------------------------------------------------------- recovery */

/**
 * The post-lapse flow. Every word here is chosen against the abstinence
 * violation effect: name what happened, extract one change, move on the same
 * day. No streak-shaming, no "you have lost everything" screen.
 */
export function openRelapseFlow(preselected = []) {
  const selected = new Set(preselected);
  let note = '';
  let plan = '';

  const body = h`
    <div class="stack">
      <div class="card card--accent">
        <p class="prose" style="margin:0">
          <strong>Read this before anything else.</strong> Your lifetime clean days are not going anywhere —
          they get banked right now, permanently. What predicts whether this becomes one day or one month is
          not the slip. It is the next twenty minutes.
        </p>
      </div>

      ${raw(passageCard(passageFor('lapse', String(Date.now() >> 22)), {}))}

      <div>
        <div class="section-title" style="margin-top:6px"><span>What was actually going on?</span></div>
        <div class="row wrap" style="gap:7px">
          ${TRIGGERS.map((t) => raw(h`<button class="chip ${selected.has(t.id) ? 'is-on' : ''}" data-trig="${t.id}">${t.label}</button>`))}
        </div>
      </div>

      <label class="field">
        <span>What happened, in one or two lines</span>
        <textarea id="rl-note" placeholder="Where were you, what came just before it, what were you avoiding?"></textarea>
        <span class="hint">This is data for the pattern view, not a confession. Write it flat and factual.</span>
      </label>

      <label class="field">
        <span>One thing that changes because of this</span>
        <textarea id="rl-plan" placeholder="If I am in bed with my phone after midnight, then I get up and put it in the kitchen."></textarea>
        <span class="hint">Make it an if–then, and make it about the situation, not about trying harder.</span>
      </label>

      ${raw(evidenceCard('abstinenceViolation', { full: true }))}
    </div>`;

  sheet({
    title: 'What happened',
    size: 'full',
    body,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Log it and start again</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const trig = ev.target.closest('[data-trig]');
        if (trig) {
          const id = trig.dataset.trig;
          if (selected.has(id)) selected.delete(id); else selected.add(id);
          trig.classList.toggle('is-on', selected.has(id));
          haptic(8);
          return;
        }
        if (ev.target.closest('[data-save]')) {
          note = el.querySelector('#rl-note')?.value.trim() || '';
          plan = el.querySelector('#rl-plan')?.value.trim() || '';
          const banked = logEpisode({ triggers: Array.from(selected), note, lessonPlan: plan });
          if (plan) {
            import('../core/recovery.js').then((m) => m.addPlan('the same situation happens again', plan));
          }
          close();
          toast(banked > 0 ? `${banked} clean days banked permanently. Day one again.` : 'Logged. Day one again.', { tone: 'good' });
          refresh();
        }
      });
    },
  });
}
