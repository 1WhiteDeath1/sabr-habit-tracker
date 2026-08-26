// night.js — the shutdown ritual.
//
// The reason this screen exists: almost every ruined morning was decided the
// night before. A day with no explicit ending bleeds into the next one, and the
// hours between Isha and sleep are where both the procrastination and the
// relapses actually happen. So the day gets a closing ceremony.

import { h, raw, actions, haptic, toast, xpBurst, qaRow } from '../ui/dom.js';
import { getState, mutate } from '../core/store.js';
import { XP, uid } from '../core/schema.js';
import { grantXp } from '../core/game.js';
import { todayKey, prettyDayLong, parseHM, prettyTime } from '../core/dates.js';
import { dayProgress } from '../core/habits.js';
import { passageFor } from '../data/scripture.js';
import { passageCard, evidenceCard } from '../ui/widgets.js';
import { refresh, go } from '../core/router.js';
import { entriesFor } from '../core/ledger.js';
import { openEntrySheet } from './ledger.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';
import { gateScreen, gateMount } from '../ui/gate.js';

const CHECKS = [
  { id: 'phone',  label: 'Phone charging outside the bedroom' },
  { id: 'alarm',  label: 'Alarm set for Fajr' },
  { id: 'plan',   label: 'Tomorrow’s first task decided' },
  { id: 'wudu',   label: 'Wudu before lying down' },
  { id: 'mulk',   label: 'Surah al-Mulk' },
];

const MOODS = [
  { v: 1, icon: icon('moodBad'), label: 'Rough' },
  { v: 2, icon: icon('moodLow'), label: 'Low' },
  { v: 3, icon: icon('moodFlat'), label: 'Flat' },
  { v: 4, icon: icon('moodGood'), label: 'Good' },
  { v: 5, icon: icon('moodGreat'), label: 'Strong' },
];

function journalFor(state, key) {
  return state.journal[key] || { gratitude: ['', '', ''], win: '', lesson: '', mood: null, energy: null, tomorrow: '', checks: {}, shutdown: false };
}

export const nightScreen = {
  render() {
    const gate = gateScreen('night', { back: '#/today', backLabel: 'Today' });
    if (gate) return gate;

    const state = getState();
    const key = todayKey();
    const j = journalFor(state, key);
    const progress = dayProgress(state, key);
    const done = j.shutdown;
    const ledgerCount = entriesFor(key, state).length;

    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/today" class="muted" style="font-size:.85rem">‹ Today</a>
          <div class="eyebrow" style="margin-top:8px">${prettyDayLong(key)}</div>
          <h1>Close the day</h1>
        </header>

        <div class="stack">
          ${done ? raw(h`
            <div class="card card--accent">
              <div class="card__title">${icon('check')} The day is finished</div>
              <p class="prose" style="margin:0">Shutdown complete. Whatever is left is tomorrow's problem, and tomorrow's problem is not yours right now.</p>
            </div>`) : raw('')}

          <div class="card">
            <div class="row-between">
              <div>
                <div style="font-weight:640">${progress.done} of ${progress.total} habits</div>
                <div class="muted" style="font-size:.82rem">${verdict(progress)}</div>
              </div>
              <div class="pill ${progress.pct >= 0.7 ? 'pill--accent' : ''}">${Math.round(progress.pct * 100)}%</div>
            </div>
          </div>

          <div class="section-title"><span>1 · How was today, honestly</span></div>
          <div class="row" style="gap:7px">
            ${MOODS.map((m) => raw(h`
              <button class="chip grow ${j.mood === m.v ? 'is-on' : ''}" data-act="mood" data-v="${m.v}"
                      style="flex-direction:column;gap:3px;padding:11px 4px">
                <span style="font-size:1.25rem">${m.icon}</span>
                <span style="font-size:.66rem">${m.label}</span>
              </button>`))}
          </div>
          <div id="mood-note" class="muted" style="font-size:.83rem;line-height:1.5;min-height:1.2em">${moodNote(j.mood)}</div>

          <div class="section-title"><span>2 · One thing that went right</span></div>
          <input type="text" id="nt-win" value="${j.win}" placeholder="Even a small one. Especially a small one.">

          <div class="section-title"><span>3 · Three specific things you are grateful for</span></div>
          <div class="stack-sm">
            ${[0, 1, 2].map((i) => raw(h`<input type="text" data-grat="${i}" value="${(j.gratitude || [])[i] || ''}" placeholder="${i === 0 ? 'Specific, not "my family"' : ''}">`))}
          </div>

          <div class="section-title"><span>4 · Tomorrow’s first move</span></div>
          <input type="text" id="nt-tomorrow" value="${j.tomorrow}" placeholder="At 6:10, at my desk, I open the file and write one paragraph.">
          <div class="card" style="margin-top:8px;padding:10px 14px">
            ${raw(qaRow('Write the time and the place',
              'Deciding it now, while you are calm, is the whole intervention — you will not be able to decide it well at 6am.'))}
          </div>

          <div class="section-title"><span>5 · Anything to account for?</span></div>
          <div class="row" style="gap:10px">
            <button class="btn btn--ghost grow" data-act="ledger" data-type="omission">Didn’t do</button>
            <button class="btn btn--ghost grow" data-act="ledger" data-type="commission">Did wrong</button>
          </div>
          <div class="card" style="margin-top:8px;padding:10px 14px">
            ${raw(qaRow(h`${ledgerCount ? `${ledgerCount} logged today` : 'Nothing logged today'}`,
              'Logging earns XP and never deducts it — the only version of this book that helps is a true one.'))}
          </div>

          <div class="section-title"><span>6 · The checklist</span></div>
          <div class="card">
            ${CHECKS.map((c) => raw(h`
              <label class="switch" style="padding:8px 0">
                <span style="font-size:.92rem">${c.label}</span>
                <input type="checkbox" data-check="${c.id}" ${j.checks?.[c.id] ? 'checked' : ''}>
              </label>`))}
          </div>

          <div class="card">${raw(passageCard(passageFor('night', key), { state }))}</div>

          ${raw(evidenceCard('sleepConsistency', { full: true }))}

          <button class="btn btn--primary btn--lg btn--block" data-act="finish" style="margin-top:6px">
            ${done ? 'Update and close' : 'The day is finished'}
          </button>
          <p class="muted center" style="font-size:.78rem;margin-top:-2px">
            Target wake time: ${prettyTime(parseHM(state.settings.wakeTarget) ?? 300)}
          </p>
        </div>
      </div>`;
  },

  mount(root) {
    if (gateMount(root)) return;
    const key = todayKey();

    const save = (patch) => {
      mutate((s) => {
        const cur = s.journal[key] || { gratitude: ['', '', ''], checks: {} };
        s.journal[key] = { ...cur, ...patch, at: Date.now() };
      });
    };

    actions(root, {
      ledger: (el, ds) => openEntrySheet(ds.type, () => refresh()),
      mood: (el, ds) => {
        const v = Number(ds.v);
        save({ mood: v });
        root.querySelectorAll('[data-act="mood"]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.v) === v));
        root.querySelector('#mood-note').textContent = moodNote(v);
        haptic(10);
      },
      finish: (el) => {
        const state = getState();
        const j = journalFor(state, key);
        const gratitude = Array.from(root.querySelectorAll('[data-grat]')).map((i) => i.value.trim());
        const win = root.querySelector('#nt-win').value.trim();
        const tomorrow = root.querySelector('#nt-tomorrow').value.trim();
        const already = j.shutdown;

        save({ gratitude, win, tomorrow, shutdown: true });

        if (tomorrow && !already) {
          mutate((s) => { s.focus.tasks.push({ id: uid('t'), title: tomorrow, done: false, createdAt: Date.now(), fromNight: key }); });
        }

        if (!already) {
          const gained = XP.shutdown + (gratitude.filter(Boolean).length ? XP.journal : 0);
          grantXp(gained, 'waqt');
          xpBurst(gained, el);
          sfx('settle');
          haptic([20, 50, 20, 50, 70]);
          toast('Day closed. Put the phone down.', { icon: icon('moon'), tone: 'good' });
        } else {
          toast('Updated');
        }
        go('today');
      },
    });

    root.addEventListener('change', (ev) => {
      const c = ev.target.closest('[data-check]');
      if (!c) return;
      mutate((s) => {
        const cur = s.journal[key] || { gratitude: ['', '', ''], checks: {} };
        cur.checks = { ...(cur.checks || {}), [c.dataset.check]: c.checked };
        s.journal[key] = cur;
      });
      haptic(8);
    });
  },
};

function verdict(p) {
  if (p.total === 0) return 'Nothing was scheduled today.';
  if (p.pct === 1) return 'Everything you planned, you did.';
  if (p.pct >= 0.6) return 'A solid day. Not a perfect one, and that is fine.';
  if (p.pct > 0) return 'Partial. Partial still beats zero, and zero was the alternative.';
  return 'Nothing today. It is one day. Tomorrow the counter is open again.';
}

function moodNote(v) {
  switch (v) {
    case 1: return 'Rough days are data, not verdicts. Sleep is the only task tonight.';
    case 2: return 'Low. If this is the third night in a row, look at sleep and movement before anything else.';
    case 3: return 'Flat is normal and unremarkable. Most days are flat.';
    case 4: return 'Good. Note what was different — that is usable information.';
    case 5: return 'Strong. Write down what made it so, while you still remember.';
    default: return '';
  }
}
