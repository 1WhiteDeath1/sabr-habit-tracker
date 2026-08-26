// habits.js (screen) — manage habits, browse the library, edit a habit.
// Three views behind one route: #/habits, #/habits/library, #/habits/edit/<id>

import { h, raw, actions, haptic, toast, sheet, confirmSheet, qaRow } from '../ui/dom.js';
import { slotStatus, MAX_SLOTS } from '../core/comeback.js';
import { DIFFICULTY, DIFFICULTY_ORDER, wallet, priceTag, difficultyOf, costOf } from '../core/economy.js';
import { STAKE_KINDS, describeStake, accrue, settle, startStake, stopStake } from '../core/stake.js';
import { isOwned } from '../core/unlocks.js';
import { gateCard, gateMount } from '../ui/gate.js';
import { getState } from '../core/store.js';
import { CATEGORIES, PRAYERS, PRAYER_LABEL, SLOTS, SLOT_ORDER, makeHabit } from '../core/schema.js';
import { addHabit, updateHabit, deleteHabit, archiveHabit, streakOf, completionRate, fromLibrary } from '../core/habits.js';
import { PACKS, LIBRARY, packItems } from '../data/library.js';
import { habitRow, evidenceCard } from '../ui/widgets.js';
import { WEEKDAY_SHORT, todayKey } from '../core/dates.js';
import { refresh, go } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';

export const habitsScreen = {
  render(route) {
    const view = route.params[0];
    if (view === 'library') return renderLibrary(route.params[1]);
    if (view === 'edit') return renderEditor(route.params[1]);
    return renderList();
  },

  mount(root, route) {
    const view = route.params[0];
    if (view === 'library') return mountLibrary(root);
    if (view === 'edit') return mountEditor(root, route.params[1]);
    return mountList(root);
  },
};

/* ----------------------------------------------------------------- list */

/**
 * The slot meter.
 *
 * Two separate limits, deliberately shown as one thing: how many slots your
 * level has opened, and whether the habits already in them are holding well
 * enough to take another. The second is what stops a new habit quietly
 * replacing one you stopped doing — the game should pay for keeping, not for
 * collecting.
 */
function slotCard(state) {
  const st = slotStatus(state);
  const w = wallet(state);
  const pips = Array.from({ length: st.total }, (_, i) =>
    `<i class="${i < st.used ? 'is-used' : 'is-free'}"></i>`).join('');

  let note;
  if (st.reason === 'full') {
    note = st.nextAt
      ? h`All ${st.total} in use. The next one opens at level ${st.nextAt}.`
      : h`All ${MAX_SLOTS} in use \u2014 that is the ceiling. Archive one to swap.`;
  } else if (st.reason === 'holding') {
    note = h`A slot is open, but <strong>${st.weakest.habit.title}</strong> is at
      ${Math.round(st.weakest.rate * 100)}% over three weeks. Get that back up first.`;
  } else {
    note = h`${st.free} slot${st.free === 1 ? '' : 's'} free.`;
  }

  return h`
    <div class="card slotcard ${st.canAdd ? '' : 'is-locked'}" style="margin-bottom:10px">
      <div class="row-between" style="margin-bottom:9px">
        <span style="font-weight:800;font-size:.92rem">${st.used} of ${st.total} habits</span>
        <span class="slotpips">${raw(pips)}</span>
      </div>
      <p class="prose" style="margin:0;font-size:.86rem">${raw(note)}</p>

      <a class="wallet" href="#/vault">
        <div class="wallet__row">
          <span class="wallet__k">Budget</span>
          <span class="wallet__v">${w.balance.toLocaleString()} XP free ›</span>
        </div>
        <div class="wallet__bar">
          <i style="width:${w.earned ? ((w.committed / w.earned) * 100).toFixed(1) : 0}%"></i>
        </div>
        <div class="wallet__row wallet__row--sub">
          <span>${w.committed.toLocaleString()} committed</span>
          <span>${w.earned.toLocaleString()} earned all time</span>
        </div>
      </a>

      <div style="margin-top:9px">
        ${raw(qaRow('Why habits cost anything',
          'A habit costs XP by how hard it is, and you start with enough for three easy ones or one difficult one. It is the same advice this app has always given \u2014 start small \u2014 except the game now enforces it instead of suggesting it. Nothing is lost: archiving a habit gives the whole cost back, so the budget is something you commit rather than money you burn, and your level never moves because that runs on lifetime XP.'))}
      </div>
      <div style="margin-top:7px">
        ${raw(qaRow('Why there is a limit at all',
          'Habits automate over roughly two months each, and goals pursued at once compete for the same attention. Holding a small set until it is genuinely automatic beats starting six. Three is a defensible opening number, not a discovered one \u2014 the evidence sets a constraint, not a magic figure.'))}
      </div>
    </div>`;
}

/**
 * The stake: a consequence you set while thinking clearly.
 *
 * The best-evidenced mechanic in this app — Giné, Karlan and Zinman found
 * forfeit-on-failure accounts raised smoking quit rates by roughly a third, and
 * the effect outlasted the account itself. A reminder competes with how you
 * feel; a stake does not care how you feel.
 *
 * Deliberately not automatic and deliberately escapable. The app records what
 * you owe and you settle it in the world — it cannot move money and should not
 * try — and you can lower or cancel the rule whenever you like, because a stake
 * you cannot escape makes lying to your own tracker the rational move.
 */
function stakeCard(state) {
  // Priced high on purpose — a commitment device only works if setting it up
  // was itself a commitment. See data/unlocks.js.
  if (!isOwned('stake', state)) return gateCard('stake');

  const st = state.stake || {};
  if (!st.enabled) {
    return h`
      <div class="card" style="padding:12px 14px;margin-bottom:10px">
        ${raw(qaRow('Put something on it',
          'Name a consequence for a fully missed day \u2014 sadaqah, extra rakats, anything you will actually follow through on. Commitment devices are the best-evidenced mechanism in this app: forfeit-on-failure accounts raised smoking quit rates by about a third in a randomised trial, and the effect was still there after the account had gone. Nothing is taken automatically and you can cancel it whenever you like.'))}
        <button class="btn btn--ghost btn--sm btn--block" data-act="setstake" style="margin-top:9px">Set a stake</button>
      </div>`;
  }

  const kind = STAKE_KINDS[st.kind] || STAKE_KINDS.custom;
  const unit = st.unitLabel || kind.unit;
  const owedLabel = kind.id === 'sadaqah' ? `${unit}${st.owed}` : `${st.owed} ${unit}`.trim();

  return h`
    <div class="card stakecard ${st.owed ? 'is-owing' : ''}" style="margin-bottom:10px">
      <div class="row-between">
        <span style="font-weight:800;font-size:.92rem">${describeStake(st)}</span>
        <button class="iconbtn" data-act="editstake" aria-label="Change the stake">${icon('gear', { size: 17 })}</button>
      </div>
      ${st.owed ? raw(h`
        <div class="stakecard__owed">
          <span class="stakecard__n">${owedLabel}</span>
          <span class="stakecard__cap">owed \u00b7 ${kind.verb} it and mark it settled</span>
        </div>
        <button class="btn btn--primary btn--sm btn--block" data-act="settlestake" style="margin-top:9px">I have settled it</button>`)
      : raw(h`<p class="muted" style="margin:7px 0 0;font-size:.82rem;font-weight:600">
          Nothing owed. ${st.settled ? `${st.settled} settled so far.` : 'Keep it that way.'}
        </p>`)}
    </div>`;
}

function renderList() {
  const state = getState();
  const key = todayKey();
  const live = state.habits.filter((x) => !x.archived).sort((a, b) => a.order - b.order);
  const archived = state.habits.filter((x) => x.archived);

  const byCat = {};
  for (const hab of live) (byCat[hab.category] ||= []).push(hab);

  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">${live.length} active</div>
        <h1>Your habits</h1>
      </header>

      ${raw(slotCard(state))}
      ${raw(stakeCard(state))}

      <div class="row" style="gap:8px;margin-bottom:6px">
        <button class="btn btn--primary grow" data-act="library">${icon('books')} From the library</button>
        <button class="btn btn--ghost" data-act="new">Custom</button>
      </div>

      ${live.length === 0 ? raw(h`
        <div class="card" style="margin-top:14px;padding:12px 14px">
          ${raw(qaRow('Start with two or three',
            'Not ten. The number you can hold through your worst week is the number that is actually working — everything above that is a plan for feeling bad.'))}
        </div>`) : raw('')}

      <div class="stack">
        ${raw(Object.keys(byCat).map((cat) => h`
          <div class="section-title"><span>${CATEGORIES[cat]?.label || cat}</span></div>
          <div>${byCat[cat].map((hab) => raw(habitRow(hab, key, { variant: 'manage', state })))}</div>
        `).join(''))}

        ${archived.length ? raw(h`
          <div class="section-title"><span>Archived · ${archived.length}</span></div>
          <div>${archived.map((hab) => raw(h`
            <div class="listrow" data-act="unarchive" data-id="${hab.id}">
              <span class="listrow__icon">${icon(CATEGORIES[hab.category]?.icon || 'box')}</span>
              <span class="grow muted">${hab.title}</span>
              <span class="pill">restore</span>
            </div>`))}</div>`) : raw('')}
      </div>
    </div>`;
}

function mountList(root) {
  gateMount(root);
  actions(root, {
    setstake:  () => openStakeSheet(),
    editstake: () => openStakeSheet(),
    settlestake: () => {
      settle();
      sfx('note');
      haptic([14, 30, 20]);
      toast('Settled. The record only counts what you actually did.', { tone: 'good' });
      refresh();
    },
    library: () => { if (!blocked()) go('habits/library'); },
    new: () => { if (!blocked()) go('habits/edit/new'); },
    edit: (el, ds) => go(`habits/edit/${ds.id}`),
    unarchive: (el, ds) => { archiveHabit(ds.id, false); toast('Restored'); refresh(); },
  });
}

/* -------------------------------------------------------------- library */

/**
 * Refuse the add and say why. Returns true when it refused.
 * Swapping is always allowed — archive one, add one — because the cap is on how
 * many run at once, not on which habit you are permitted to want.
 */
function blocked(item) {
  // Cost first: it is the most specific refusal and the easiest to act on.
  if (item) {
    const p = priceTag(item);
    if (!p.affordable) {
      toast(`${p.label} costs ${p.cost} XP. You are ${p.short} short \u2014 keep going and it opens up.`,
        { tone: 'warn', ms: 3600 });
      sfx('deny');
      haptic([14, 60, 14]);
      return true;
    }
  }
  const st = slotStatus();
  if (st.canAdd) return false;
  if (st.reason === 'full') {
    toast(st.nextAt
      ? `All ${st.total} slots are in use. Archive one, or reach level ${st.nextAt}.`
      : 'Every slot is in use. Archive one to swap it out.', { tone: 'warn', ms: 3200 });
  } else {
    toast(`${st.weakest.habit.title} is at ${Math.round(st.weakest.rate * 100)}%. Bring it back before adding another.`,
      { tone: 'warn', ms: 3600 });
  }
  sfx('deny');
  haptic([14, 60, 14]);
  return true;
}

function renderLibrary(packId) {
  const state = getState();
  const existing = new Set(state.habits.map((x) => x.title));

  if (!packId) {
    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/habits" class="muted" style="font-size:.85rem">‹ Habits</a>
          <h1 style="margin-top:6px">Library</h1>
        </header>
        ${raw(slotCard(getState()))}
        <div class="card" style="margin-bottom:14px;padding:10px 14px">
          ${raw(qaRow('What every habit here comes with',
            'A cue, a two-minute version, and the reason it matters — the three things that decide whether a habit survives past week two.'))}
        </div>
        <div class="stack-sm">
          ${PACKS.map((p) => raw(h`
            <div class="listrow" data-act="pack" data-id="${p.id}">
              <span class="listrow__icon">${icon(p.icon)}</span>
              <span class="grow">
                <span style="display:block;font-weight:640">${p.title}</span>
                <span class="muted" style="font-size:.79rem">${p.subtitle}</span>
              </span>
              <span class="pill">${packItems(p.id).length}</span>
              <span class="listrow__chev">›</span>
            </div>`))}
        </div>
      </div>`;
  }

  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return h`<div class="screen"><p class="prose">Unknown pack.</p><a class="btn btn--ghost" href="#/habits/library">Back</a></div>`;

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/habits/library" class="muted" style="font-size:.85rem">‹ Library</a>
        <h1 style="margin-top:6px;display:flex;align-items:center;gap:10px">${icon(pack.icon, { size: 26 })} ${pack.title}</h1>
      </header>
      <p class="muted" style="font-size:.86rem;line-height:1.55;margin-bottom:16px">${pack.blurb}</p>
      <div class="stack-sm">
        ${packItems(packId).map((item) => raw(libraryCard(item, existing.has(item.title))))}
      </div>
    </div>`;
}

/** What a habit costs, and whether you can pay for it right now. */
function pricePill(item) {
  const p = priceTag(item);
  return h`<span class="pricepill ${p.affordable ? '' : 'is-short'}"
    title="${p.blurb}">${p.label} \u00b7 ${p.cost} XP</span>`;
}

/** Setting or changing the stake. */
function openStakeSheet() {
  const st = getState().stake || {};
  sheet({
    title: 'Your stake',
    body: h`
      <div class="stack">
        <p class="prose" style="margin:0">
          Charged for a day where <strong>nothing</strong> due got done. A partial day is a day
          you showed up, and it never counts against you.
        </p>
        <label class="field">
          <span>What you owe per missed day</span>
          <select id="stk-kind">
            ${Object.values(STAKE_KINDS).map((k) => raw(h`<option value="${k.id}" ${st.kind === k.id ? 'selected' : ''}>${k.label} \u2014 ${k.blurb}</option>`))}
          </select>
        </label>
        <div class="row" style="gap:10px">
          <label class="field grow" style="margin:0">
            <span>Amount</span>
            <input type="number" id="stk-amount" min="1" max="999" value="${st.amount || 2}">
          </label>
          <label class="field grow" style="margin:0">
            <span>Label</span>
            <input type="text" id="stk-unit" value="${st.unitLabel || ''}" placeholder="\u00a3, rakats, pages\u2026">
          </label>
        </div>
        <p class="muted" style="margin:0;font-size:.79rem;line-height:1.5">
          The app records the debt. It never takes anything and never tells anyone \u2014 settling it
          is between you and Allah.
        </p>
      </div>`,
    footer: h`
      ${st.enabled ? raw('<button class="btn btn--ghost" data-do="off">Turn off</button>') : raw('')}
      <button class="btn btn--primary" data-do="save">${st.enabled ? 'Update' : 'Start'}</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const act = ev.target.closest('[data-do]')?.dataset.do;
        if (act === 'off') { stopStake(); toast('Stake off. Anything already owed stays owed.'); close(); refresh(); }
        if (act === 'save') {
          startStake({
            kind: el.querySelector('#stk-kind').value,
            amount: Math.min(999, Math.max(1, Number(el.querySelector('#stk-amount').value) || 1)),
            unitLabel: el.querySelector('#stk-unit').value.trim(),
          });
          haptic([14, 30, 20]);
          toast('Stake set. It counts fully missed days only.', { tone: 'good' });
          close();
          refresh();
        }
      });
    },
  });
}

function libraryCard(item, added) {
  const cat = CATEGORIES[item.category];
  return h`
    <div class="card">
      <div class="row" style="align-items:flex-start;gap:11px">
        <span class="lib__icon" style="color:${raw(CATEGORIES[item.category]?.color || 'var(--accent)')}">${icon(CATEGORIES[item.category]?.icon || 'check', { size: 22 })}</span>
        <div class="grow">
          <div style="font-weight:650">${item.title}</div>
          <div class="muted" style="font-size:.82rem;margin-top:4px;line-height:1.45">${item.cue}</div>
          ${item.tiny ? raw(h`<div class="pill pill--wrap" style="margin-top:8px">${icon('timer')} 2-min: ${item.tiny}</div>`) : raw('')}
        </div>
      </div>
      <div class="row wrap" style="margin-top:11px;gap:7px">
        ${raw(pricePill(item))}
        <span class="pill" style="color:${raw(cat?.color || 'var(--accent)')}">${cat?.label || item.category}</span>
        ${item.anchorPrayer ? raw(h`<span class="pill">after ${PRAYER_LABEL[item.anchorPrayer]}</span>`) : raw('')}
        <span class="grow" style="min-width:0"></span>
        ${added
          ? raw(`<span class="pill pill--accent">${icon('check', { size: 13 })} Added</span>`)
          : raw(h`<button class="btn btn--primary btn--sm" data-act="add" data-title="${item.title}">Add</button>`)}
      </div>
      ${item.proof || item.evidence ? raw(h`
        <div class="row wrap" style="gap:6px;margin-top:9px">
          ${item.proof ? raw(h`<span class="pill pill--gold">${item.proof}</span>`) : raw('')}
          ${item.evidence ? raw(h`<button class="pill" data-act="why" data-key="${item.evidence}">why this works</button>`) : raw('')}
        </div>`) : raw('')}
    </div>`;
}

function mountLibrary(root) {
  actions(root, {
    pack: (el, ds) => go(`habits/library/${ds.id}`),
    why: (el, ds) => sheet({ title: 'Why this works', body: evidenceCard(ds.key, { full: true }) }),
    add: (el, ds) => {
      const item = LIBRARY.find((x) => x.title === ds.title);
      if (!item || blocked(item)) return;
      addHabit(fromLibrary(item));
      haptic([14, 30, 20]);
      toast(`${item.title} added`, { icon: icon('checkCircle'), tone: 'good' });
      refresh();
    },
  });
}

/* --------------------------------------------------------------- editor */

function renderEditor(id) {
  const state = getState();
  const isNew = id === 'new';
  const habit = isNew ? makeHabit({ title: '' }) : state.habits.find((x) => x.id === id);
  if (!habit) return h`<div class="screen"><p class="prose">That habit no longer exists.</p><a class="btn btn--ghost" href="#/habits">Back</a></div>`;

  const others = state.habits.filter((x) => x.id !== habit.id && !x.archived);
  const cadence = habit.cadence || { type: 'daily' };
  const streak = isNew ? 0 : streakOf(habit, state);
  const rate = isNew ? 0 : completionRate(habit, state, 30);

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/habits" class="muted" style="font-size:.85rem">‹ Habits</a>
        <h1 style="margin-top:6px">${isNew ? 'New habit' : 'Edit habit'}</h1>
      </header>

      ${!isNew ? raw(h`
        <div class="statgrid" style="margin-bottom:16px">
          <div class="stat"><div class="stat__n">${streak}</div><div class="stat__l">streak</div></div>
          <div class="stat"><div class="stat__n">${Math.round(rate * 100)}%</div><div class="stat__l">last 30d</div></div>
          <div class="stat"><div class="stat__n">${CATEGORIES[habit.category]?.label || '—'}</div><div class="stat__l">type</div></div>
        </div>`) : raw('')}

      <form id="habit-form">
        <label class="field">
          <span>Habit</span>
          <input type="text" name="title" value="${habit.title}" placeholder="Qur’an after Fajr" required>
        </label>

        <label class="field">
          <span>When ___, I will ___ <span class="hint" style="display:inline">(this is the part that works)</span></span>
          <textarea name="cue" placeholder="After I pray Fajr, I open the mushaf before standing up from the mat.">${habit.cue}</textarea>
          <span class="hint">Name a specific cue, place and time. Vague intentions do not survive a tired Tuesday.</span>
        </label>

        <label class="field">
          <span>The two-minute version</span>
          <input type="text" name="tiny" value="${habit.tiny}" placeholder="Read three ayat">
          <span class="hint">What you do on your worst day. It counts as done.</span>
        </label>

        <label class="field">
          <span>Why this matters to you</span>
          <textarea name="why" placeholder="Written in your own words — this is what you read when you want to skip.">${habit.why}</textarea>
        </label>

        <label class="field">
          <span>How hard is this, honestly?</span>
          <select id="hb-difficulty" name="difficulty">
            ${DIFFICULTY_ORDER.map((d) => raw(h`<option value="${d}" ${difficultyOf(habit) === d ? 'selected' : ''}>${DIFFICULTY[d].label} \u00b7 ${DIFFICULTY[d].cost} XP \u2014 ${DIFFICULTY[d].blurb}</option>`))}
          </select>
          <span class="hint">The price is the honesty check. Grading a hard habit as easy only buys you a habit you will not keep.</span>
        </label>

        <label class="field">
          <span>Category</span>
          <select name="category">
            ${Object.values(CATEGORIES).map((c) => raw(h`<option value="${c.id}" ${habit.category === c.id ? 'selected' : ''}>${c.label}</option>`))}
          </select>
        </label>

        <div class="field">
          <span style="display:block;font-size:.78rem;font-weight:650;color:var(--text-2);margin-bottom:6px">How often</span>
          <div class="row wrap" style="gap:7px;margin-bottom:10px">
            <button type="button" class="chip ${cadence.type === 'daily' ? 'is-on' : ''}" data-cad="daily">Every day</button>
            <button type="button" class="chip ${cadence.type === 'weekdays' ? 'is-on' : ''}" data-cad="weekdays">Certain days</button>
            <button type="button" class="chip ${cadence.type === 'times' ? 'is-on' : ''}" data-cad="times">X times a week</button>
          </div>
          <div id="cad-weekdays" class="${cadence.type === 'weekdays' ? '' : 'hidden'}">
            <div class="row wrap" style="gap:6px">
              ${WEEKDAY_SHORT.map((d, i) => raw(h`<button type="button" class="chip ${(cadence.days || []).includes(i) ? 'is-on' : ''}" data-day="${i}">${d}</button>`))}
            </div>
          </div>
          <div id="cad-times" class="${cadence.type === 'times' ? '' : 'hidden'}">
            <input type="number" name="perWeek" min="1" max="7" value="${cadence.perWeek || 3}">
          </div>
        </div>

        <label class="field">
          <span>Anchor it to a prayer</span>
          <select name="anchorPrayer">
            <option value="">Not anchored</option>
            ${PRAYERS.map((p) => raw(h`<option value="${p}" ${habit.anchorPrayer === p ? 'selected' : ''}>After ${PRAYER_LABEL[p]}</option>`))}
          </select>
          <span class="hint">Prayers are the most reliable cues you already have. Use them.</span>
        </label>

        <label class="field">
          <span>Or a time of day</span>
          <select name="slot">
            ${SLOT_ORDER.map((s) => raw(h`<option value="${s}" ${habit.slot === s ? 'selected' : ''}>${SLOTS[s].label}</option>`))}
          </select>
        </label>

        ${others.length ? raw(h`
          <label class="field">
            <span>Stack it after another habit</span>
            <select name="anchorHabitId">
              <option value="">Do not stack</option>
              ${others.map((o) => raw(h`<option value="${o.id}" ${habit.anchorHabitId === o.id ? 'selected' : ''}>After ${o.title}</option>`))}
            </select>
          </label>`) : raw('')}
      </form>

      ${raw(evidenceCard('implementationIntentions', { full: true }))}

      <div class="stack" style="margin-top:18px">
        <button class="btn btn--primary btn--block" data-act="save">${isNew ? 'Create habit' : 'Save changes'}</button>
        ${!isNew ? raw(h`
          <button class="btn btn--ghost btn--block" data-act="archive">Archive — keep the history</button>
          <button class="btn btn--danger btn--block" data-act="delete">Delete and erase its history</button>`) : raw('')}
      </div>
    </div>`;
}

function mountEditor(root, id) {
  const isNew = id === 'new';
  const form = root.querySelector('#habit-form');
  const state = getState();
  const existing = isNew ? null : state.habits.find((x) => x.id === id);
  let cadence = { ...(existing?.cadence || { type: 'daily' }) };

  root.addEventListener('click', (ev) => {
    const cad = ev.target.closest('[data-cad]');
    if (cad) {
      cadence = cad.dataset.cad === 'weekdays'
        ? { type: 'weekdays', days: cadence.days || [1, 3, 5] }
        : cad.dataset.cad === 'times'
          ? { type: 'times', perWeek: cadence.perWeek || 3 }
          : { type: 'daily' };
      root.querySelectorAll('[data-cad]').forEach((b) => b.classList.toggle('is-on', b.dataset.cad === cad.dataset.cad));
      root.querySelector('#cad-weekdays').classList.toggle('hidden', cadence.type !== 'weekdays');
      root.querySelector('#cad-times').classList.toggle('hidden', cadence.type !== 'times');
      root.querySelectorAll('[data-day]').forEach((b) => b.classList.toggle('is-on', (cadence.days || []).includes(Number(b.dataset.day))));
      haptic(8);
      return;
    }
    const day = ev.target.closest('[data-day]');
    if (day) {
      const n = Number(day.dataset.day);
      cadence.days = cadence.days || [];
      cadence.days = cadence.days.includes(n) ? cadence.days.filter((x) => x !== n) : [...cadence.days, n].sort();
      day.classList.toggle('is-on', cadence.days.includes(n));
      haptic(8);
    }
  });

  actions(root, {
    save: () => {
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      if (!title) { toast('Give it a name first', { tone: 'warn' }); return; }
      if (cadence.type === 'times') cadence.perWeek = Math.min(7, Math.max(1, Number(fd.get('perWeek')) || 3));
      if (cadence.type === 'weekdays' && !(cadence.days || []).length) { toast('Pick at least one day', { tone: 'warn' }); return; }

      const patch = {
        title,
        cue: String(fd.get('cue') || '').trim(),
        tiny: String(fd.get('tiny') || '').trim(),
        why: String(fd.get('why') || '').trim(),
        category: String(fd.get('category') || 'mind'),
        difficulty: Math.min(5, Math.max(1, Number(fd.get('difficulty')) || 2)),
        anchorPrayer: String(fd.get('anchorPrayer') || '') || null,
        anchorHabitId: String(fd.get('anchorHabitId') || '') || null,
        slot: String(fd.get('slot') || 'anytime'),
        cadence,
      };
      if (isNew) {
        if (blocked(patch)) return;
        addHabit(patch);
      } else {
        // An edit only owes the difference: this habit's current cost is
        // already committed, so charging the full new price would refuse a
        // change the budget can actually cover.
        const current = getState().habits.find((x) => x.id === id);
        const delta = costOf(patch) - costOf(current || {});
        if (delta > wallet().balance) {
          toast(`Moving up to ${DIFFICULTY[patch.difficulty].label} costs another ${delta} XP. You have ${wallet().balance}.`,
            { tone: 'warn', ms: 3600 });
          sfx('deny');
          haptic([14, 60, 14]);
          return;
        }
        updateHabit(id, patch);
      }
      haptic([14, 30, 20]);
      toast(isNew ? 'Habit created' : 'Saved', { tone: 'good' });
      go('habits');
    },
    archive: async () => {
      const ok = await confirmSheet({ title: 'Archive this habit?', message: 'It disappears from Today but every day you logged is kept. You can restore it later.', confirmLabel: 'Archive' });
      if (ok) { archiveHabit(id, true); go('habits'); }
    },
    delete: async () => {
      const ok = await confirmSheet({
        title: 'Delete permanently?',
        message: 'This removes the habit and every log entry for it. Streaks and quest progress that depended on it will drop. Archiving keeps the history instead.',
        confirmLabel: 'Delete forever', tone: 'danger',
      });
      if (ok) { deleteHabit(id); toast('Deleted'); go('habits'); }
    },
  });
}
