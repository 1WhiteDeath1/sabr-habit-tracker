// quests.js (screen) — the quest board.
//
// Main quests render as a winding path of pressable nodes, one per chain: the
// clearest way to show "here is where you are, here is the next thing" without
// making you read a list. Side quests stay as cards below, deliberately looser,
// because they are optional and should not look like obligations.

import { h, raw, actions, haptic, toast, xpBurst, sheet, bar, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { mainBoard, claimMain, todaysOffers, sideStatus, acceptSide, completeSide } from '../core/quests.js';
import { ATTRS } from '../core/schema.js';
import { heroCard, attrStrip, sideQuestCard } from '../ui/widgets.js';
import { isOwned } from '../core/unlocks.js';
import { gateCard, gateMount } from '../ui/gate.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';
import { refresh } from '../core/router.js';

/** Horizontal offsets that make the column of nodes read as a winding path. */
const OFFSETS = [0, -52, -80, -52, 0, 52, 80, 52];

export const questsScreen = {
  render() {
    const state = getState();
    const board = mainBoard(state);
    // The main line is free forever — it is the campaign, and locking it would
    // lock the app. Side quests are the optional extra, so they are the part
    // with a price on it.
    const sideOn = isOwned('sidequests', state);
    const offers = sideOn ? todaysOffers(state) : [];

    // The first node you can actually act on gets the bubble above it.
    const nextIndex = board.findIndex((row) => !row.done && !row.locked);

    return h`
      <div class="screen">
        <header class="screen__head">
          <div class="eyebrow">Quest board</div>
          <h1>Your campaign</h1>
        </header>

        <div class="stack">
          ${raw(heroCard(state))}
          <div class="card">${raw(attrStrip(state))}</div>
        </div>

        <div class="card" style="padding:11px 14px">
          ${raw(qaRow('How any of this works',
            raw(`<p><strong>XP</strong> comes from doing the things — a habit is 6 to 14, a class attended is 8,
                 a deadline closed is 16 to 55. It is never taken away.</p>
                 <p><strong>Levels</strong> are what XP buys you. Each one either adds a habit slot or puts a new
                 part of the app on the shelf. The bar at the top of this screen names the next one.</p>
                 <p><strong>Quests</strong> are not tasks — there is nothing here to tick. They are chains that
                 watch what you are already doing and pay out when you cross a number. You do not start them
                 and you cannot fail them; the only thing you do is claim one when it lights up.</p>
                 <p><strong>The five attributes</strong> above are just XP sorted by which part of your life it
                 came from. Prayer feeds Ruh, exercise feeds Jasad, study feeds Aql.</p>`)))}
        </div>

        <div class="section-title"><span>Main quests</span>
          <span class="muted" style="text-transform:none;letter-spacing:0">claim when they light up</span></div>
        <div class="path">
          ${raw(board.map((row, i) => pathNode(row, i, i === nextIndex)).join(''))}
        </div>

        <div class="section-title"><span>Side quests · today</span>
          <span class="pill">optional</span></div>
        ${sideOn ? raw(h`
          <div class="card" style="padding:10px 14px;margin-bottom:12px">
            ${raw(qaRow('Three offers, rolled fresh each morning',
              'Skipping them costs nothing — no penalty, no backlog. They are here for the days you want more, not to give you a second job.'))}
          </div>
          <div class="stack-sm">
            ${offers.map((q) => raw(sideQuestCard(q, state)))}
          </div>`) : raw(gateCard('sidequests'))}

      </div>`;
  },

  mount(root) {
    gateMount(root);
    actions(root, {
      claim: (el, ds) => {
        const xp = claimMain(ds.id);
        if (!xp) return;
        sfx('claim');
        haptic([18, 50, 25, 50, 40]);
        xpBurst(xp, el, 'var(--gold)');
        toast(`Quest complete · +${xp} XP`, { icon: icon('trophy'), tone: 'good' });
        refresh();
      },
      qdetail: (el, ds) => openQuestDetail(ds.id),
      accept: (el, ds) => { acceptSide(ds.id); haptic(10); refresh(); },
      complete: (el, ds) => {
        const xp = completeSide(ds.id);
        if (xp) { sfx('claim'); haptic([12, 40, 18]); xpBurst(xp, el); toast('Side quest complete', { icon: icon('target'), tone: 'good' }); }
        refresh();
      },
    });
  },
};

/* ----------------------------------------------------------------- path */

function pathNode(row, index, isNext) {
  const { quest, progress, locked, done } = row;
  const attr = ATTRS[quest.attr];
  const claimable = !done && !locked && progress.met;
  const dx = OFFSETS[index % OFFSETS.length];

  const face = locked ? 'lock' : done ? 'star' : (attr?.icon || 'target');
  const color = locked ? 'var(--border-str)' : done ? 'var(--gold)' : (attr?.color || 'var(--green)');
  const edge  = locked ? 'var(--border)' : done ? 'var(--gold-edge)' : shadeFor(quest.attr);

  const cls = ['node', locked ? 'is-locked' : '', done ? 'is-done' : '', claimable ? 'is-claimable' : ''].filter(Boolean).join(' ');

  const bubble = isNext
    ? raw(claimable
      ? h`<button class="startbubble is-claim" data-act="claim" data-id="${quest.id}">Claim +${quest.xp} XP</button>`
      : '<div class="startbubble">Start</div>')
    : raw('');

  return h`
    <div class="pathnode">
      <div class="pathnode__offset" style="--dx:${dx}px">
        ${bubble}
        <button class="${raw(cls)}" style="--node:${raw(color)};--node-edge:${raw(edge)}"
                data-act="qdetail" data-id="${quest.id}"
                aria-label="${quest.chainTitle}: ${quest.title}">
          ${raw(locked || done ? '' : nodeRing(progress.pct, 'var(--gold)'))}
          ${icon(face, { size: 34, cls: 'ico--bold' })}
        </button>
        <div class="pathnode__label">
          <div class="pathnode__chain">${quest.chainTitle}</div>
          <div class="pathnode__title">${done ? 'Chain complete' : quest.title}</div>
          ${done ? raw('') : raw(h`<div class="pathnode__prog">${progress.value} / ${progress.target}</div>`)}
          ${done || locked ? raw('') : raw(h`<div class="pathnode__note">${quest.note}</div>`)}
        </div>
      </div>
    </div>`;
}

/** Thin progress ring hugging a path node. */
function nodeRing(pct, color) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <svg class="node__ring" viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="${r}" stroke="rgba(0,0,0,.10)" stroke-width="5"/>
      <circle cx="48" cy="48" r="${r}" stroke="${color}" stroke-width="5"
              stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
              transform="rotate(-90 48 48)"/>
    </svg>`;
}

/** Each attribute colour needs a darker twin for the node's 3D edge. */
function shadeFor(attrId) {
  return ({
    ruh: 'var(--green-edge)',
    jasad: 'var(--orange-edge)',
    aql: 'var(--blue-edge)',
    sabr: 'var(--purple-edge)',
    waqt: 'var(--gold-edge)',
  })[attrId] || 'var(--green-edge)';
}

/* ---------------------------------------------------------- side quests */

/* --------------------------------------------------------------- detail */

function romanise(n) {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n] || String(n);
}

function openQuestDetail(id) {
  const state = getState();
  const row = mainBoard(state).find((r) => r.quest.id === id);
  if (!row) return;
  const { quest, progress, locked, done } = row;
  const attr = ATTRS[quest.attr];
  const claimable = !done && !locked && progress.met;

  sheet({
    title: quest.title,
    body: h`
      <div class="stack">
        <div class="center" style="padding:4px 0 2px">
          <div class="node" style="--node:${raw(attr?.color || 'var(--green)')};--node-edge:${raw(shadeFor(quest.attr))};margin:0 auto;pointer-events:none">
            ${icon(locked ? 'lock' : done ? 'star' : (attr?.icon || 'target'), { size: 30, cls: 'ico--bold' })}
          </div>
          <div class="quest__tier" style="margin-top:14px">${quest.chainTitle} · ${romanise(quest.tier)} of ${quest.tierCount}</div>
        </div>
        <p class="prose">${quest.blurb}</p>
        <div>
          <div class="row-between muted" style="font-size:.8rem;margin-bottom:7px;font-weight:800">
            <span>Progress</span><span class="mono">${progress.value} / ${progress.target}</span>
          </div>
          ${bar(progress.pct, { color: claimable ? 'var(--gold)' : (attr?.color || 'var(--green)') })}
        </div>
        <div class="row wrap" style="gap:7px">
          <span class="pill pill--gold">+${quest.xp} XP</span>
          <span class="pill">${icon(attr?.icon || 'target', { size: 13 })} ${attr?.label} — ${attr?.sub}</span>
        </div>
        <div class="evidence">
          <div class="evidence__title">How this is counted</div>
          <div>${countingExplainer(quest.goal)}</div>
        </div>
      </div>`,
    footer: claimable
      ? h`<button class="btn btn--gold btn--block" data-claim="${quest.id}">Claim +${quest.xp} XP</button>`
      : '',
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-claim]');
        if (!btn) return;
        const xp = claimMain(btn.dataset.claim);
        close();
        if (xp) {
          sfx('claim');
          haptic([18, 50, 25, 50, 40]);
          toast(`Quest complete · +${xp} XP`, { icon: icon('trophy'), tone: 'good' });
        }
        refresh();
      });
    },
  });
}

function countingExplainer(goal) {
  switch (goal.type) {
    case 'categoryDays':
      return `Every day on which you complete at least one ${goal.category} habit adds one. Days are counted cumulatively, not consecutively — a missed day never subtracts.`;
    case 'prayerAnchorDays':
      return `Counts each day you complete a habit anchored to ${goal.prayer}. Cumulative, so a missed day costs you nothing already earned.`;
    case 'cleanDays':
      return 'Your current clean streak in the Shield section. This is the one goal that does reset on a lapse — but your lifetime total never does.';
    case 'urgesSurvived':
      return 'Each urge you log as ridden out on the SOS screen counts once.';
    case 'focusSessions':
      return 'Each focus block you finish without abandoning it counts once.';
    case 'shutdowns':
      return 'Each completed evening shutdown ritual counts once.';
    case 'reviews':
      return 'Each weekly review you complete counts once.';
    case 'guardsAndPlans':
      return 'Environment defences switched on, plus if–then plans written. Both count.';
    case 'classesAttended':
      return 'Every class you mark present on the Uni tab counts once.';
    case 'uniTasksDone':
      return 'Every academic deadline you tick off counts once.';
    case 'habitTitleDays':
      return 'Counts each day you complete a matching habit. Cumulative.';
    default:
      return 'Derived automatically from your logs.';
  }
}
