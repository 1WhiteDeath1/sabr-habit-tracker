// onboarding.js — first run.
//
// Six short steps. The goal is not to collect data; it is to make you write
// down the two things that decide whether any of this survives contact with a
// bad week: who you are trying to become, and which two or three habits you
// would keep if you could only keep two or three.

import { h, raw, actions, haptic, toast } from '../ui/dom.js';
import { mutate } from '../core/store.js';
import { MOTIVATIONS, CATEGORIES } from '../core/schema.js';
import { addHabit, fromLibrary } from '../core/habits.js';
import { starterSetFor, LIBRARY } from '../data/library.js';
import { DIFFICULTY, STARTING_XP, difficultyOf } from '../core/economy.js';
import { startRecovery } from '../core/recovery.js';
import { passageCard } from '../ui/widgets.js';
import { passageFor } from '../data/scripture.js';
import { go, refresh } from '../core/router.js';
import { icon } from '../ui/icons.js';

const draft = {
  step: 0,
  name: '',
  motivations: new Set(),
  identity: '',
  why: '',
  picks: new Set(),
  shield: false,
};

const STEPS = ['welcome', 'name', 'motivation', 'identity', 'habits', 'shield'];

export const onboardingScreen = {
  render() {
    const step = STEPS[draft.step];
    return h`
      <div class="screen" style="min-height:100vh;display:flex;flex-direction:column">
        <div class="obsteps">
          ${STEPS.map((_, i) => raw(`<i class="${i <= draft.step ? 'is-on' : ''}"></i>`))}
        </div>
        <div class="grow">${raw(renderStep(step))}</div>
        <div class="stack" style="margin-top:24px;padding-bottom:20px">
          ${raw(footerFor(step))}
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      next: () => { if (validate()) { draft.step = Math.min(STEPS.length - 1, draft.step + 1); refresh(); } },
      back: () => { draft.step = Math.max(0, draft.step - 1); refresh(); },
      motiv: (el, ds) => {
        toggle(draft.motivations, ds.id);
        el.classList.toggle('is-on', draft.motivations.has(ds.id));
        haptic(8);
      },
      pick: (el, ds) => {
        toggle(draft.picks, ds.title);
        haptic(8);
        // A full re-render rather than a class toggle: the budget meter and the
        // greyed-out prices both depend on the whole selection, so flipping one
        // chip in place left the numbers frozen at their first paint.
        refresh();
      },
      shieldYes: () => { draft.shield = true; finish(); },
      shieldNo:  () => { draft.shield = false; finish(); },
      finish: () => finish(),
    });

    const nameInput = root.querySelector('#ob-name');
    if (nameInput) {
      nameInput.value = draft.name;
      nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
      setTimeout(() => nameInput.focus(), 260);
    }
    const idInput = root.querySelector('#ob-identity');
    if (idInput) {
      idInput.value = draft.identity;
      idInput.addEventListener('input', () => { draft.identity = idInput.value; });
    }
    const whyInput = root.querySelector('#ob-why');
    if (whyInput) {
      whyInput.value = draft.why;
      whyInput.addEventListener('input', () => { draft.why = whyInput.value; });
    }
  },
};

function toggle(set, key) { if (set.has(key)) set.delete(key); else set.add(key); }

/** What the current picks add up to. */
function pickedCost(list) {
  return list
    .filter((item) => draft.picks.has(item.title))
    .reduce((n, item) => n + DIFFICULTY[difficultyOf(item)].cost, 0);
}

function validate() {
  const step = STEPS[draft.step];
  if (step === 'motivation' && draft.motivations.size === 0) {
    toast('Pick at least one — the app uses these to choose what it shows you', { tone: 'warn' });
    return false;
  }
  if (step === 'habits' && draft.picks.size === 0) {
    toast('Pick at least one habit to start with', { tone: 'warn' });
    return false;
  }
  if (step === 'habits') {
    // The budget makes the old "six is a lot" warning unnecessary — it is no
    // longer advice you can wave past, it is simply what you can afford.
    const suggested = starterSetFor(Array.from(draft.motivations));
    const list = suggested.length ? suggested : LIBRARY.slice(0, 8);
    const over = pickedCost(list) - STARTING_XP;
    if (over > 0) {
      toast(`That is ${over} XP over budget. Drop one, or trade it for something easier.`, { tone: 'warn', ms: 3400 });
      return false;
    }
  }
  return true;
}

function renderStep(step) {
  switch (step) {
    case 'welcome':
      return h`
        <div style="padding-top:24px">
          <div style="width:104px;height:104px;border-radius:50%;background:var(--green);box-shadow:0 8px 0 var(--green-edge);display:grid;place-items:center;font-size:3.2rem;margin-bottom:22px">${icon('ruh')}</div>
          <h1 style="font-size:2.1rem">Sabr</h1>
          <p class="prose" style="margin-top:12px">
            A habit tracker built around three ideas: that consistency beats intensity,
            that shame is what actually breaks streaks, and that the five prayers are the
            most reliable habit cues you will ever have.
          </p>
          <p class="prose">
            Everything stays on this phone. No account, no server, nothing uploaded.
          </p>
          <div style="margin-top:20px">${raw(passageCard(passageFor('tiny', 'welcome'), {}))}</div>
        </div>`;

    case 'name':
      return h`
        <h1>What should it call you?</h1>
        <p class="prose" style="margin-top:8px">Optional. It just makes the mornings read less like a form.</p>
        <input type="text" id="ob-name" placeholder="Your name" style="margin-top:18px">`;

    case 'motivation':
      return h`
        <h1>What is actually driving this?</h1>
        <p class="prose" style="margin-top:8px">Be honest rather than aspirational. This decides which habits get suggested and what gets shown to you at 1am.</p>
        <div class="stack-sm" style="margin-top:18px">
          ${Object.values(MOTIVATIONS).map((m) => raw(h`
            <button class="chip ${draft.motivations.has(m.id) ? 'is-on' : ''}" data-act="motiv" data-id="${m.id}"
                    style="width:100%;text-align:left;padding:15px 16px;border-radius:14px;font-size:.95rem;display:flex;align-items:center;gap:10px">
              ${icon(m.icon, { size: 20 })}<span>${m.label}</span>
            </button>`))}
        </div>`;

    case 'identity':
      return h`
        <h1>Who are you becoming?</h1>
        <p class="prose" style="margin-top:8px">
          Not a goal. A description of the person. Every habit you complete is one small piece of
          evidence for it — that is the mechanism, and it is why identity outlasts motivation.
        </p>
        <label class="field" style="margin-top:18px">
          <span>I am someone who…</span>
          <input type="text" id="ob-identity" placeholder="keeps his word to himself, even when no one is watching">
        </label>
        <label class="field">
          <span>And why this matters, in your own words</span>
          <textarea id="ob-why" placeholder="Write it as if you were explaining it to yourself on the worst night of the month. This is what gets shown back to you then."></textarea>
        </label>`;

    case 'habits': {
      const suggested = starterSetFor(Array.from(draft.motivations));
      const list = suggested.length ? suggested : LIBRARY.slice(0, 8);
      const spent = pickedCost(list);
      const left = STARTING_XP - spent;
      return h`
        <h1>Spend your first ${STARTING_XP} XP</h1>
        <p class="prose" style="margin-top:8px">
          Every habit costs by how hard it is. This buys three easy ones, or one difficult one
          and nothing else. That is the whole lesson of this app in one screen — you get more
          from a small set held well than a big set held badly.
        </p>
        <p class="prose" style="margin-top:8px;font-size:.85rem;color:var(--text-2)">
          You earn more by showing up, and it is never spent — archive a habit and its cost
          comes straight back. Later the same budget is what switches on the optional parts of
          the app, so everything here runs on this one number.
        </p>

        <div class="budget ${left < 0 ? 'is-over' : ''}">
          <div class="budget__row">
            <span class="budget__k">${left < 0 ? `${-left} XP over` : `${left} XP left`}</span>
            <span class="budget__v">${spent} of ${STARTING_XP} spent</span>
          </div>
          <div class="budget__bar"><i style="width:${Math.min(100, (spent / STARTING_XP) * 100).toFixed(1)}%"></i></div>
        </div>

        <div class="stack-sm" style="margin-top:14px">
          ${list.map((item) => {
            const d = DIFFICULTY[difficultyOf(item)];
            const on = draft.picks.has(item.title);
            const unaffordable = !on && d.cost > left;
            return raw(h`
            <button class="chip ${on ? 'is-on' : ''} ${unaffordable ? 'is-broke' : ''}" data-act="pick" data-title="${item.title}"
                    style="width:100%;text-align:left;padding:14px 16px;border-radius:14px">
              <span style="display:flex;align-items:center;gap:9px;font-weight:640;font-size:.95rem">
                ${icon(CATEGORIES[item.category]?.icon || 'check', { size: 18 })}
                <span class="grow">${item.title}</span>
                <span class="pricepill ${unaffordable ? 'is-short' : ''}">${d.cost}</span>
              </span>
              <span style="display:block;font-size:.78rem;opacity:.75;margin-top:3px;line-height:1.4;font-weight:400">${item.cue}</span>
            </button>`);
          })}
        </div>`;
    }

    case 'shield':
      return h`
        <h1>One last thing</h1>
        <p class="prose" style="margin-top:8px">
          There is a section called <strong>Shield</strong> for breaking a pornography habit — an urge-surfing
          timer, trigger patterns, environment defences, and a recovery flow built so that a lapse never
          wipes out your history.
        </p>
        <p class="prose">
          It stays hidden unless you turn it on, and you can turn it on or off later from that tab.
          Everything in it is stored on this phone only.
        </p>
        <div class="card card--accent" style="margin-top:16px">
          <p class="prose" style="margin:0">Nothing in that section will call you a failure. That is a design rule, not a nicety —
          shame after a lapse is the single best predictor of a full relapse.</p>
        </div>`;

    default: return '';
  }
}

function footerFor(step) {
  if (step === 'shield') {
    return h`
      <button class="btn btn--primary btn--lg btn--block" data-act="shieldYes">Turn Shield on</button>
      <button class="btn btn--ghost btn--block" data-act="shieldNo">Not now</button>`;
  }
  return h`
    <button class="btn btn--primary btn--lg btn--block" data-act="next">
      ${step === 'welcome' ? 'Begin' : 'Continue'}
    </button>
    ${draft.step > 0 ? raw('<button class="btn btn--ghost btn--block" data-act="back">Back</button>') : raw('')}`;
}

function finish() {
  const picks = Array.from(draft.picks);
  mutate((s) => {
    s.profile.name = draft.name.trim();
    s.profile.identity = draft.identity.trim();
    s.profile.why = draft.why.trim();
    s.profile.motivations = Array.from(draft.motivations);
    s.profile.onboarded = true;
  });

  for (const title of picks) {
    const item = LIBRARY.find((x) => x.title === title);
    if (!item) continue;
    addHabit(fromLibrary(item));
  }

  if (draft.shield || draft.motivations.has('purity')) startRecovery();

  haptic([20, 50, 20, 50, 80]);
  // Straight into the tour rather than Today: a screen full of unfamiliar
  // habits is the worst moment to be left working out what anything does.
  go('tutorial');
}
