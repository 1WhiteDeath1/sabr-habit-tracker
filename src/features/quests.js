// quests.js (screen) — the quest board.
//
// Main quests render as a winding path of pressable nodes, one per chain: the
// clearest way to show "here is where you are, here is the next thing" without
// making you read a list. Side quests stay as cards below, deliberately looser,
// because they are optional and should not look like obligations.

import { h, raw, actions, haptic, toast, xpBurst, sheet, confirmSheet, bar, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { activeTrial, offered, acceptTrial, abandonTrial, settleTrial,
         trialProgress, daysLeft, isExpired, TRIAL_BY_ID } from '../core/trials.js';
import { confetti } from '../ui/confetti.js';
import { nextGate, ascend as doAscend, ladder } from '../core/ascend.js';
import { playerLevel, rankFor } from '../core/game.js';
import { mainBoard, claimMain, todaysOffers, sideStatus, acceptSide, completeSide,
         pursuit, setPursuit, isPursued, PURSUIT_BONUS } from '../core/quests.js';
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

    // Anything sitting at 100% is the only part of the board with a verb, so it
    // stays above the fold; the rest collapse. Fourteen chains you cannot act on
    // is not a board, it is a wall.
    const claimable = board.filter((row) => !row.done && !row.locked && row.progress.met);

    return h`
      <div class="screen">
        <header class="screen__head screen__head--tight">
          <div class="eyebrow">The ascent</div>
        </header>

        <div class="stack">
          ${raw(ascentHead(state))}
          ${raw(gateCardAscent(state))}
          ${raw(pursuitCard(state))}
          ${raw(trialCard(state))}
        </div>

        <div class="section-title"><span>The climb</span></div>
        ${raw(ladderList(state))}

        <div class="section-title"><span>Every chain</span>
          <span class="muted" style="text-transform:none;letter-spacing:0">counting whether you look or not</span></div>
        ${claimable.length ? raw(h`
          <div class="path" style="margin-bottom:6px">
            ${raw(claimable.map((row) => pathNode(row, board.indexOf(row), true)).join(''))}
          </div>`) : raw('')}
        <details class="card allchains">
          <summary>
            <span class="grow">${board.filter((r) => !r.done).length} chains running</span>
            <i class="qa__mark" aria-hidden="true">?</i>
          </summary>
          <div class="path" style="margin-top:14px">
            ${raw(board.filter((row) => !claimable.includes(row))
              .map((row, i) => pathNode(row, i, false)).join(''))}
          </div>
        </details>

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
      pickpursuit: () => openPursuitSheet(),
      ascend: (el) => {
        const res = doAscend();
        if (!res) return;
        celebrateAscension(res, el);
        refresh();
      },
      taketrial: (el, ds) => {
        acceptTrial(ds.id);
        sfx('claim'); haptic([16, 40, 22]);
        toast('Trial accepted · seven days', { icon: icon('flame'), tone: 'good' });
        refresh();
      },
      settletrial: (el) => {
        const res = settleTrial();
        if (!res) return;
        if (res.outcome === 'won') {
          sfx('levelup'); haptic([20, 50, 25, 50, 40]);
          confetti({ count: 110, origin: el.getBoundingClientRect() });
          xpBurst(res.xp, el, 'var(--gold)');
          toast(`${res.spec.title} · +${res.xp} XP`, { icon: icon('trophy'), tone: 'good', ms: 3400 });
        } else if (res.outcome === 'partial') {
          sfx('claim'); haptic([14, 30, 20]);
          xpBurst(res.xp, el, 'var(--blue)');
          toast(`${res.value} of ${res.target} · +${res.xp} XP for the part you held`, { ms: 3600 });
        } else {
          haptic(10);
          toast(`${res.value} of ${res.target}. Nothing lost — the days still count on your record.`, { ms: 3800 });
        }
        refresh();
      },
      droptrial: async () => {
        const ok = await confirmSheet({
          title: 'Step away from this trial?',
          message: 'It costs nothing and it is not recorded as a loss. You can take another whenever you want one.',
          confirmLabel: 'Step away',
        });
        if (!ok) return;
        abandonTrial(); haptic(10); refresh();
      },
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

/* ====================================================================== */
/* The board.                                                             */
/*                                                                        */
/* This screen used to open with a copy of the top of Me — the same level  */
/* card, the same five attributes — and then list fourteen chains you      */
/* could not act on. It read as a worse Me, because that is what it was.   */
/*                                                                        */
/* It answers one question now, and it is the question nothing else in the */
/* app was asking: what am I pushing on over the next couple of weeks?     */
/* Today covers now, Habits covers forever, Me covers the past. This is    */
/* the middle distance, and both halves of it have a verb — you choose a   */
/* pursuit, and you accept a trial.                                        */
/* ====================================================================== */

function trialCard(state) {
  const rec = activeTrial(state);

  if (!rec) {
    const pool = offered(state).slice(0, 3);
    if (!pool.length) return '';
    return h`
      <div class="card trialpick">
        <div class="trialpick__k">Take a trial</div>
        <p class="trialpick__b">
          Seven days, one at a time, and you can decline. It is the only thing here
          you are able to fail — which is the only reason finishing one means anything.
        </p>
        <div class="stack-sm" style="margin-top:12px">
          ${pool.map((t) => raw(h`
            <button class="trialopt" data-act="taketrial" data-id="${t.id}">
              <span class="grow">
                <span class="trialopt__t">${t.title}</span>
                <span class="trialopt__d">${t.desc}</span>
              </span>
              <span class="pricepill">+${t.xp}</span>
            </button>`))}
        </div>
      </div>`;
  }

  const spec = TRIAL_BY_ID[rec.id];
  const p = trialProgress(rec, state);
  const left = daysLeft(rec);
  const over = isExpired(rec);
  const won = p.met;

  return h`
    <div class="card trial ${won ? 'is-won' : over ? 'is-over' : ''}">
      <div class="row-between">
        <span class="trial__k">${won ? 'Trial complete' : over ? 'The week is up' : 'Trial running'}</span>
        <span class="trial__left">${won || over ? '' : `${left} day${left === 1 ? '' : 's'} left`}</span>
      </div>
      <div class="trial__t">${spec.title}</div>
      <div class="trial__d">${spec.desc}</div>

      <div class="trial__meter">
        <div class="trial__bar"><i style="width:${(p.pct * 100).toFixed(1)}%"></i></div>
        <span class="trial__n">${p.raw} / ${p.target}</span>
      </div>

      ${won || over
        ? raw(h`<button class="btn ${won ? 'btn--primary' : 'btn--ghost'} btn--block" data-act="settletrial"
              style="margin-top:11px">${won ? `Claim +${spec.xp} XP` : 'Close it out'}</button>`)
        : raw(h`<p class="trial__note">${spec.note}</p>
            <button class="btn btn--ghost btn--sm btn--block" data-act="droptrial"
                    style="margin-top:9px">Step away from it</button>`)}
    </div>`;
}

/**
 * The chosen chain.
 *
 * Shows the concrete next number rather than the chain's name, because "The
 * Foundation, tier 2" tells you nothing about what to do this afternoon and
 * "4 of 21 days" tells you everything.
 */
function pursuitCard(state) {
  const p = pursuit(state);
  if (!p) {
    return h`
      <div class="card pursuit pursuit--empty">
        <div class="pursuit__k">Nothing chosen</div>
        <p class="pursuit__b">
          Fourteen chains are running whether you look at them or not. Name the one
          that matters at the moment and it pays half as much again — the rest keep
          counting quietly underneath.
        </p>
        <button class="btn btn--primary btn--block" data-act="pickpursuit" style="margin-top:11px">
          Choose what you are pushing on
        </button>
      </div>`;
  }

  const { quest, progress } = p;
  return h`
    <div class="card pursuit">
      <div class="row-between">
        <span class="pursuit__k">Pushing on</span>
        <button class="pursuit__swap" data-act="pickpursuit">Change</button>
      </div>
      <div class="pursuit__t">${quest.chainTitle}</div>
      <div class="pursuit__s">${quest.title} — ${quest.note}</div>
      <div class="pursuit__meter">
        <div class="pursuit__bar"><i style="width:${(progress.pct * 100).toFixed(1)}%"></i></div>
        <span class="pursuit__n">${progress.value} / ${progress.target}</span>
      </div>
      <div class="pursuit__foot">
        ${icon('bolt', { size: 14 })}
        <span class="grow">Tiers on this chain pay +50% while it is chosen</span>
        <span class="pricepill">+${quest.xp + Math.round(quest.xp * PURSUIT_BONUS)}</span>
      </div>
    </div>`;
}

/** Choosing the chain, from the ones actually available to you. */
function openPursuitSheet() {
  const state = getState();
  const rows = mainBoard(state).filter((r) => !r.locked && !r.done);
  sheet({
    title: 'What are you pushing on?',
    body: h`
      <div class="stack-sm">
        <p class="prose" style="margin:0 0 4px">
          One at a time. You can change it whenever you like — the others keep counting
          underneath, they just do not pay the premium.
        </p>
        ${rows.map((r) => raw(h`
          <button class="trialopt ${isPursued(r.quest.chain, state) ? 'is-on' : ''}"
                  data-do="pick" data-chain="${r.quest.chain}">
            <span class="grow">
              <span class="trialopt__t">${r.quest.chainTitle}</span>
              <span class="trialopt__d">${r.quest.note}</span>
            </span>
            <span class="pricepill">${r.progress.value}/${r.progress.target}</span>
          </button>`))}
        ${state.game.pursuit ? raw(h`
          <button class="btn btn--ghost btn--block" data-do="clear" style="margin-top:6px">
            Stop pushing on anything
          </button>`) : raw('')}
      </div>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const pick = ev.target.closest('[data-do="pick"]');
        if (pick) {
          setPursuit(pick.dataset.chain);
          sfx('claim'); haptic([14, 30, 20]);
          close(); refresh();
          return;
        }
        if (ev.target.closest('[data-do="clear"]')) {
          setPursuit(null); haptic(10); close(); refresh();
        }
      });
    },
  });
}

/* ====================================================================== */
/* The Ascent.                                                            */
/*                                                                        */
/* This was a stack of cards with a checkbox list in it, which is a form.  */
/* Three things separate a game screen from a form, and none of them is    */
/* decoration:                                                            */
/*                                                                        */
/*   Place.  A climb is vertical and you are somewhere on it. The ladder   */
/*           reads upward, with a spine running through it and your token  */
/*           sitting on the rung you actually occupy.                      */
/*   Ritual. A gate is a thing you break, not a form you complete. The     */
/*           requirements are seals: unlit discs that take light as they   */
/*           are met, and the gate opens only when the last one catches.   */
/*   Weight. One emblem, large, at the top — the number that everything    */
/*           else on the screen is about.                                  */
/*                                                                        */
/* Restraint is the constraint: gold on a dark ground, one glow, one       */
/* pulse. The moment this reads as a slot machine it has failed a          */
/* different way.                                                          */
/* ====================================================================== */

/** Progress drawn as an arc around the crest rather than a bar under it. */
function crestRing(pct, sealed) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <svg class="crest__ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="${r}" class="crest__track"/>
      <circle cx="60" cy="60" r="${r}" class="crest__fill ${sealed ? 'is-sealed' : ''}"
              stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>`;
}

function ascentHead(state) {
  const lv = playerLevel(state);
  const r = rankFor(lv.level);
  const gate = nextGate(state);

  return h`
    <div class="crest ${lv.capped ? 'is-sealed' : ''}">
      <div class="crest__halo" aria-hidden="true"></div>

      <div class="crest__emblem">
        ${raw(crestRing(lv.capped ? 1 : lv.pct, lv.capped))}
        <div class="crest__inner">
          <span class="crest__lv">${lv.level}</span>
          <span class="crest__lvl">Level</span>
        </div>
        ${lv.capped ? raw(h`<span class="crest__seal">${icon('lock', { size: 14 })}</span>`) : raw('')}
      </div>

      <div class="crest__name">${r.name}</div>
      <div class="crest__mean">${r.meaning}</div>

      ${lv.capped
        ? raw(h`
          <div class="crest__banked">
            <span class="crest__bn">${lv.banked.toLocaleString()}</span>
            <span class="crest__bl">XP held behind the seal · ${lv.wouldBe - lv.level} level${lv.wouldBe - lv.level === 1 ? '' : 's'}</span>
          </div>`)
        : raw(h`
          <div class="crest__next">
            ${lv.need - lv.into} XP to level ${lv.level + 1}${gate ? ` · seal at ${gate.level}` : ''}
          </div>`)}
    </div>`;
}

/**
 * The gate.
 *
 * Each requirement is a seal — a disc that is dark until its condition is met
 * and lit afterwards. Same information a checklist carried, arranged so that
 * the screen has a state rather than a completion percentage: five dark discs
 * is a different feeling from "0/5", and the last one catching is an event.
 */
function gateCardAscent(state) {
  const gate = nextGate(state);
  if (!gate) {
    return h`
      <div class="gateway is-crowned">
        <div class="gateway__k">Muhsin</div>
        <div class="gateway__t">Every seal broken</div>
        <p class="gateway__b">There is nothing above this rank. Levels run on freely from here.</p>
      </div>`;
  }

  const seals = [
    { label: `Level ${gate.level}`, have: Math.min(gate.xpHave, gate.level), n: gate.level, met: gate.xpReady, glyph: 'bolt' },
    ...gate.reqs.map((r) => ({
      label: r.label, have: Math.min(r.have, r.n), n: r.n, met: r.met,
      glyph: r.id === 'streak' ? 'flame' : r.id === 'trials' ? 'trophy'
        : r.id === 'automatic' ? 'sprout' : 'star',
    })),
  ];
  const lit = seals.filter((s) => s.met).length;

  return h`
    <div class="gateway ${gate.ready ? 'is-open' : ''}">
      <div class="gateway__arch" aria-hidden="true"></div>
      <div class="gateway__k">${gate.ready ? 'The seal is broken' : `The ${ordinalWord(gate.rank)} seal`}</div>
      <div class="gateway__t">${gate.name}</div>
      <div class="gateway__m">${gate.meaning}</div>

      <div class="seals">
        ${seals.map((s) => raw(h`
          <div class="seal ${s.met ? 'is-lit' : ''}">
            <div class="seal__disc">${icon(s.glyph, { size: 19 })}</div>
            <div class="seal__n">${s.have}<span>/${s.n}</span></div>
            <div class="seal__l">${s.label}</div>
          </div>`))}
      </div>

      ${gate.ready
        ? raw(h`
          <button class="btn btn--primary btn--lg btn--block gateway__go" data-act="ascend">
            Ascend to ${gate.name}
          </button>`)
        : raw(h`<p class="gateway__b">${gate.blurb}</p>
                <div class="gateway__count">${lit} of ${seals.length} lit</div>`)}
    </div>`;
}

function ordinalWord(n) {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'][n] || `${n}th`;
}

/**
 * The climb.
 *
 * Rendered top-down from the highest rank so it reads as something above you,
 * with a spine connecting the rungs and your token on the one you hold. Ranks
 * you have not reached name their seal level instead of their progress, so the
 * track doubles as the map of what is left.
 */
function ladderList(state) {
  const rows = ladder(state).slice().reverse();
  return h`
    <div class="track">
      ${rows.map((r) => raw(h`
        <div class="trung ${r.held ? 'is-held' : ''} ${r.current ? 'is-here' : ''}">
          <div class="trung__spine" aria-hidden="true">
            <span class="trung__node">${r.held ? raw(icon('check', { size: 12 })) : raw('')}</span>
          </div>
          <div class="trung__card">
            <div class="row-between">
              <span class="trung__name">${r.name}</span>
              <span class="trung__lv">${r.from}–${r.to}</span>
            </div>
            <div class="trung__mean">${r.meaning}</div>
            ${r.held || r.current
              ? raw(h`<div class="trung__bar"><i style="width:${(r.pct * 100).toFixed(1)}%"></i></div>`)
              : raw(h`<div class="trung__locked">${icon('lock', { size: 12 })} seal at level ${r.from}</div>`)}
          </div>
        </div>`))}
    </div>`;
}

/** The moment of breaking through. */
function celebrateAscension(res, el) {
  sfx('levelup');
  haptic([30, 60, 30, 60, 30, 60, 140]);
  confetti({ count: 150, power: 15, origin: el?.getBoundingClientRect() });

  const overlay = document.createElement('div');
  overlay.className = 'levelup';
  overlay.innerHTML = `
    <div class="levelup__card">
      <div class="levelup__rays" aria-hidden="true"></div>
      <div class="levelup__badge"><span class="levelup__n">${res.to}</span></div>
      <div class="levelup__eyebrow">Ascended</div>
      <h1 class="levelup__h">${res.gate.name}</h1>
      <p class="levelup__rank">${res.gate.meaning}</p>
      <div class="lvrewards">
        <div class="lvrewards__k">Released</div>
        <div class="lvrow" style="--i:0"><span class="lvrow__e">⚡</span>
          <span><strong>Level ${res.from} → ${res.to}</strong><em>${res.gained} level${res.gained === 1 ? '' : 's'} from banked XP</em></span></div>
      </div>
      <button class="btn btn--primary btn--lg btn--block levelup__go">Continue</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', close);
  setTimeout(close, 6400);
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
