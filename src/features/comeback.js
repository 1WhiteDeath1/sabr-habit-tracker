// comeback.js (screen) — what the app says when you come back after a gap.
//
// This screen exists because of one failure mode: two days off, and then the
// app becomes a record of failing rather than a tool. Everything on it is
// pointed at that. It never asks why you are like this, it never shows a broken
// chain, and it never asks for the same effort that just did not happen.
//
// Route: #/return

import { h, raw, actions, haptic, toast, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { go } from '../core/router.js';
import { todayKey, prettyDay } from '../core/dates.js';
import { daysAway, daysMissed, lapsedHabits, startEasyMode, logComeback, CAUSES, EASY_DAYS } from '../core/comeback.js';
import { evidenceCard } from '../ui/widgets.js';
import { noor } from './tutorial.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';

const draft = { cause: '', plan: '', ease: true };

export const comebackScreen = {
  render() {
    const state = getState();
    const key = todayKey();
    const away = daysAway(state, key);
    const missed = daysMissed(state, key);
    const lapsed = lapsedHabits(state, key);
    const totalDone = Object.values(state.logs)
      .reduce((n, day) => n + Object.keys(day).length, 0);
    const daysLogged = Object.keys(state.logs).length;
    const easeable = lapsed.filter((r) => r.habit.tiny);

    return h`
      <div class="screen">
        <header class="screen__head" style="margin-bottom:12px">
          <div class="eyebrow">${prettyDay(key)}</div>
          <h1>Welcome back</h1>
        </header>

        <div class="stack">
          <div class="card card--accent" style="display:flex;gap:13px;align-items:flex-start">
            <div style="flex:none;width:52px">${raw(noor('happy'))}</div>
            <div class="grow">
              <p style="margin:0 0 6px;font-weight:700">You missed ${missed} days.</p>
              <p style="margin:0;color:var(--text-2);font-size:.9rem;line-height:1.5;font-weight:600">
                That is a gap in a week, not a fact about you. Nothing below was deleted.
              </p>
            </div>
          </div>

          <div class="statgrid">
            <div class="stat"><div class="stat__n">${daysLogged}</div><div class="stat__l">days logged</div></div>
            <div class="stat"><div class="stat__n">${totalDone}</div><div class="stat__l">habits done</div></div>
            <div class="stat"><div class="stat__n">${state.game.xp}</div><div class="stat__l">XP kept</div></div>
          </div>

          <div class="card" style="padding:10px 14px">
            ${raw(qaRow('None of those went down while you were away',
              'A streak is a picture of the last few days. Your totals are the picture of everything, and this app never subtracts from them. That is deliberate: the reaction to a slip predicts the outcome far more than the slip does.'))}
          </div>

          <div class="section-title"><span>1 · What got in the way?</span></div>
          <div class="row wrap" style="gap:8px">
            ${CAUSES.map((c) => raw(h`
              <button class="chip ${draft.cause === c.id ? 'is-on' : ''}" data-act="cause" data-id="${c.id}">${c.label}</button>`))}
          </div>

          <div class="section-title"><span>2 · If it happens again</span></div>
          <label class="field">
            <span>Then I will…</span>
            <input type="text" id="cb-plan" value="${draft.plan}"
                   placeholder="do the two-minute version before bed, even at 1am">
            <span class="hint">One line. Something your body does, not something you feel.</span>
          </label>
          ${raw(evidenceCard('copingPlanning', { full: true }))}

          ${easeable.length ? raw(h`
            <div class="section-title"><span>3 · Make the first days smaller</span></div>
            <div class="card">
              <label class="switch" style="padding:0 0 10px">
                <span>Easy mode for ${EASY_DAYS} days</span>
                <input type="checkbox" id="cb-ease" ${draft.ease ? 'checked' : ''}>
              </label>
              <div class="stack-sm">
                ${easeable.map((r) => raw(h`
                  <div class="row-between" style="font-size:.88rem;gap:10px">
                    <span class="grow nowrap">${r.habit.title}</span>
                    <span class="pill pill--accent">${r.habit.tiny}</span>
                  </div>`))}
              </div>
              <p class="muted" style="font-size:.79rem;margin:11px 0 0;line-height:1.5">
                For ${EASY_DAYS} days these ask for the small version only, and it counts in full.
                Then they go back to normal on their own.
              </p>
            </div>`) : raw('')}

          <button class="btn btn--primary btn--lg btn--block" data-act="start" style="margin-top:6px">
            Start again today
          </button>
          <button class="btn btn--ghost btn--block" data-act="skip">Not now</button>
        </div>
      </div>`;
  },

  mount(root) {
    root.querySelector('#cb-plan')?.addEventListener('input', (ev) => { draft.plan = ev.target.value; });
    root.querySelector('#cb-ease')?.addEventListener('change', (ev) => { draft.ease = ev.target.checked; });

    actions(root, {
      cause: (el, ds) => {
        draft.cause = draft.cause === ds.id ? '' : ds.id;
        haptic(8);
        root.querySelectorAll('[data-act="cause"]').forEach((b) => {
          b.classList.toggle('is-on', b.dataset.id === draft.cause);
        });
      },
      start: () => finish({ commit: true }),
      skip:  () => finish({ commit: false }),
    });
  },
};

function finish({ commit }) {
  const state = getState();
  const key = todayKey();
  const away = daysAway(state, key);
  const easeable = lapsedHabits(state, key).filter((r) => r.habit.tiny).map((r) => r.habit.id);
  const eased = commit && draft.ease ? easeable : [];

  if (eased.length) startEasyMode(eased);
  // Logged either way: "not now" is still a return, and the gap is still data.
  logComeback({
    away,
    cause: CAUSES.find((c) => c.id === draft.cause)?.label || '',
    plan: commit ? draft.plan.trim() : '',
    eased,
  }, key);

  draft.cause = '';
  draft.plan = '';
  draft.ease = true;

  if (commit) {
    sfx('begin');
    haptic([18, 40, 18, 40, 70]);
    toast(eased.length ? `Easy mode on for ${EASY_DAYS} days. Go and do one.` : 'Good. Go and do one.',
      { icon: icon('sprout'), tone: 'good' });
  }
  go('today');
}
