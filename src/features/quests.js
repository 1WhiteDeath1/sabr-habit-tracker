// quests.js (screen) — the quest board.
//
// Main quests render as a winding path of pressable nodes, one per chain: the
// clearest way to show "here is where you are, here is the next thing" without
// making you read a list. Side quests stay as cards below, deliberately looser,
// because they are optional and should not look like obligations.

import { h, raw, actions, haptic, toast, xpBurst, sheet, confirmSheet, bar, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { activeTrial, offered, acceptTrial, abandonTrial, settleTrial,
         trialProgress, daysLeft, isExpired, TRIAL_BY_ID, TIERS, TIER_ORDER,
         pace, paceLine, trialRecord, hasWon, timesWon } from '../core/trials.js';
import { confetti } from '../ui/confetti.js';
import { todaysMove } from '../core/links.js';
import { nextGate, ascend as doAscend, ladder, currentRank, ASCENSIONS } from '../core/ascend.js';
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
  render(route) {
    const state = getState();
    const view = route.params[0] === 'map' ? 'map' : 'board';
    const gate = nextGate(state);

    return h`
      <div class="screen">
        <header class="screen__head screen__head--tight">
          <div class="eyebrow">The ascent</div>
        </header>

        ${raw(ascentHead(state))}
        ${raw(viewSwitch(view))}

        ${view === 'map'
          ? raw(roadMap(state))
          : raw(h`
            ${gate && gate.ready ? raw(readyBanner(gate)) : raw('')}
            ${raw(standingOrder(state))}
            ${raw(trialBoard(state))}`)}
      </div>`;
  },

  mount(root) {
    gateMount(root);
    actions(root, {
      climb:   () => openClimbSheet(),
      seal:    () => openSealSheet(),
      pursuit: () => openPursuitSheet(),
      taketrial: (el, ds) => {
        acceptTrial(ds.id);
        sfx('claim');
        haptic([16, 40, 22]);
        toast('Trial accepted', { icon: icon('flame'), tone: 'good' });
        refresh();
      },
      settletrial: (el) => {
        const res = settleTrial();
        if (!res) return;
        reportTrial(res, el);
        refresh();
      },
      droptrial: async () => {
        const ok = await confirmSheet({
          title: 'Step away from this trial?',
          message: 'It costs nothing and it is not recorded as a loss. You can take another whenever you want one.',
          confirmLabel: 'Step away',
        });
        if (!ok) return;
        abandonTrial();
        haptic(10);
        refresh();
      },
      chains:  () => openChainsSheet(),
      ascend: (el) => {
        const res = doAscend();
        if (!res) return;
        celebrateAscension(res, el);
        refresh();
      },
      qdetail: (el, ds) => openQuestDetail(ds.id),
      claim: (el, ds) => {
        const xp = claimMain(ds.id);
        if (!xp) return;
        sfx('claim');
        haptic([18, 50, 25, 50, 40]);
        xpBurst(xp, el, 'var(--gold)');
        toast(`Quest complete · +${xp} XP`, { icon: icon('trophy'), tone: 'good' });
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
/* The Ascent, as a board of objectives.                                  */
/*                                                                        */
/* It was six full-width blocks stacked down the page, each one well      */
/* written and the six together a wall. Every block explained itself in    */
/* prose because it had the room to, and the screen ended up needing to be */
/* read rather than seen.                                                 */
/*                                                                        */
/* The fix is the one Destiny's Director, Pokémon GO's Today view and the  */
/* Genshin character screen all use: the surface carries STATE, the words  */
/* live one tap deep. A status header, then four tiles of identical shape  */
/* — glyph, name, a number, a meter. Four seconds to read the whole        */
/* screen, and nothing lost, because every tile opens the full card that   */
/* used to be sitting on the page.                                        */
/*                                                                        */
/* The one exception is deliberate. When a seal is ready to break, that    */
/* leaves the grid and takes the full width, because a game that whispers  */
/* its biggest moment is getting the emphasis exactly backwards.          */
/* ====================================================================== */

/** The crest, compacted to a header. Tapping it opens the climb. */
function ascentHead(state) {
  const lv = playerLevel(state);
  const r = rankFor(lv.level);
  const gate = nextGate(state);
  const pct = lv.capped ? 1 : lv.pct;

  return h`
    <button class="crestbar ${lv.capped ? 'is-sealed' : ''}" data-act="climb">
      <span class="crestbar__halo" aria-hidden="true"></span>
      <span class="crestbar__emblem">
        ${raw(crestRing(pct, lv.capped))}
        <span class="crestbar__lv">${lv.level}</span>
        ${lv.capped ? raw(h`<span class="crestbar__lock">${icon('lock', { size: 11 })}</span>`) : raw('')}
      </span>
      <span class="crestbar__body">
        <span class="crestbar__name">${r.name}</span>
        <span class="crestbar__mean">${r.meaning}</span>
        <span class="crestbar__line">
          ${lv.capped
            ? raw(h`<b>${lv.banked.toLocaleString()} XP</b> banked · ${lv.wouldBe - lv.level} waiting`)
            : raw(h`${lv.need - lv.into} XP to ${lv.level + 1}${gate ? ` · seal at ${gate.level}` : ''}`)}
        </span>
      </span>
      <span class="crestbar__chev">›</span>
    </button>`;
}

function crestRing(pct, sealed) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <svg class="crestbar__ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="${r}" class="crestbar__track"/>
      <circle cx="32" cy="32" r="${r}" class="crestbar__fill ${sealed ? 'is-sealed' : ''}"
              stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>`;
}

/** The seal breaking is the loudest thing this screen ever says. */
function readyBanner(gate) {
  return h`
    <button class="ready" data-act="ascend">
      <span class="ready__arch" aria-hidden="true"></span>
      <span class="ready__k">The seal is broken</span>
      <span class="ready__t">${gate.name}</span>
      <span class="ready__m">${gate.meaning}</span>
      <span class="ready__go">Ascend</span>
    </button>`;
}

/* ====================================================================== */
/* The Ascent: a board and a map.                                         */
/*                                                                        */
/* Two views, because two different questions are being asked and neither  */
/* answers the other. The board is "what can I take on right now" — a cork */
/* wall with the trials pinned to it, the same guild-board language as     */
/* Today, so a contract is visibly an offer rather than an order. The map  */
/* is "where am I and how far does this go" — the whole road, drawn once,  */
/* with the ranks as gates on it and a marker where you are standing.      */
/*                                                                        */
/* The pursuit is neither of those. It is a standing order, so it hangs    */
/* above the board as a banner rather than sitting on it as a card: it is  */
/* not something you are being offered, it is the thing you already said   */
/* you were doing.                                                        */
/* ====================================================================== */

function viewSwitch(view) {
  return h`
    <div class="vswitch" role="tablist">
      <a class="vswitch__b ${view === 'map' ? '' : 'is-on'}" href="#/quests" role="tab">
        ${icon('calendar', { size: 14 })} Board
      </a>
      <a class="vswitch__b ${view === 'map' ? 'is-on' : ''}" href="#/quests/map" role="tab">
        ${icon('map', { size: 14 })} Map
      </a>
    </div>`;
}

/* ------------------------------------------------------------- the banner */

/**
 * The standing order.
 *
 * A banner rather than a card. You are not being offered this — you already
 * chose it, and it applies to everything underneath until you change it, which
 * is what a banner means and what a card does not.
 */
function standingOrder(state) {
  const p = pursuit(state);
  if (!p) {
    return h`
      <button class="order order--none" data-act="pursuit">
        <span class="order__ribbon" aria-hidden="true"></span>
        <span class="order__k">No standing order</span>
        <span class="order__t">Name one chain and its tiers pay half as much again</span>
      </button>`;
  }
  const { quest, progress } = p;
  const move = todaysMove(quest.goal.type, quest.goal, state);
  return h`
    <button class="order" data-act="pursuit">
      <span class="order__ribbon" aria-hidden="true"></span>
      <span class="order__k">Standing order</span>
      <span class="order__t">${quest.chainTitle}</span>
      <span class="order__bar"><i style="width:${(progress.pct * 100).toFixed(1)}%"></i></span>
      <span class="order__foot">
        <span class="grow">${move || quest.title}</span>
        <span class="order__n">${progress.value}/${progress.target}</span>
        <span class="order__bonus">+50%</span>
      </span>
    </button>`;
}

/* -------------------------------------------------------------- the board */

/** One trial, pinned. */
function trialPin(t, state, i) {
  const tier = TIERS[t.tier];
  const won = timesWon(t.id, state);
  const tilt = ((t.id.charCodeAt(0) + i * 5) % 5) - 2;
  return h`
    <button class="pin metal--${raw(tier.metal)}" style="--tilt:${tilt}deg"
            data-act="taketrial" data-id="${t.id}">
      <span class="pin__tack" aria-hidden="true"></span>
      <span class="pin__tier"><b aria-hidden="true">◆</b>${tier.label} · ${tier.days}d</span>
      <span class="pin__t">${t.title}</span>
      <span class="pin__d">${t.desc}</span>
      <span class="pin__foot">
        <span class="pin__xp">+${t.xp}</span>
        ${won ? raw(h`<span class="pin__won">won ${won}×</span>`) : raw('')}
      </span>
    </button>`;
}

/** The trial you are running, pinned alone and larger. */
function runningPin(state, rec) {
  const spec = TRIAL_BY_ID[rec.id];
  const tier = TIERS[spec.tier];
  const q = pace(rec, state);
  const move = todaysMove(spec.metric, spec.args || {}, state);

  return h`
    <div class="pin pin--live metal--${raw(tier.metal)}" style="--tilt:0deg">
      <span class="pin__tack" aria-hidden="true"></span>
      <span class="pin__tier"><b aria-hidden="true">◆</b>${tier.label} · ${tier.days}d</span>
      <span class="pin__t">${spec.title}</span>
      <span class="pin__d">${spec.desc}</span>

      <span class="pin__meter">
        <span class="pin__bar"><i style="width:${(q.p.pct * 100).toFixed(1)}%"></i></span>
        <span class="pin__n">${q.p.raw}/${q.p.target}</span>
      </span>
      <span class="pin__pace pin__pace--${raw(q.state)}">${paceLine(rec, state)}</span>
      ${move && q.state !== 'won' && q.state !== 'over'
        ? raw(h`<a class="pin__do" href="#/today">${icon('pointer', { size: 12 })} ${move}</a>`)
        : raw('')}

      <span class="pin__acts">
        ${q.state === 'won' || q.state === 'over'
          ? raw(h`<button class="btn ${q.state === 'won' ? 'btn--primary' : 'btn--ghost'} btn--sm btn--block"
                data-act="settletrial">${q.state === 'won' ? `Claim +${spec.xp} XP` : 'Close it out'}</button>`)
          : raw(h`<button class="btn btn--ghost btn--sm btn--block" data-act="droptrial">Step away</button>`)}
      </span>
    </div>`;
}

function trialBoard(state) {
  const rec = activeTrial(state);
  const record = trialRecord(state);
  const pool = rec ? [] : offered(state);

  return h`
    <div class="bboard bboard--trials">
      <div class="bboard__head">
        <span class="bboard__title">Trials</span>
        <span class="bboard__sub">${record.won} won · ${record.xp.toLocaleString()} XP</span>
      </div>

      ${rec ? raw(runningPin(state, rec)) : pool.length
        ? raw(h`<div class="pinwall">${pool.map((t, i) => raw(trialPin(t, state, i)))}</div>`)
        : raw(h`<p class="bboard__empty">
            Nothing posted. Trials appear once you hold habits one can measure.
          </p>`)}

      ${record.attempted ? raw(trialRecordBlock(record)) : raw('')}
    </div>`;
}

/* ---------------------------------------------------------------- the map */

/**
 * The whole road, drawn once.
 *
 * Rank gates are the large nodes; between them sit the chains that count
 * toward the next one. Your marker goes where you actually are, and everything
 * above it is drawn but dimmed — the point of a map is that you can see how
 * far it goes, which a list of the next three things cannot do.
 */
function roadMap(state) {
  const lv = playerLevel(state);
  const rank = currentRank(state);
  const rows = ladder(state);
  const chains = mainBoard(state);

  return h`
    <div class="road">
      ${rows.slice().reverse().map((r) => {
        // The measured gate for the rank you are on, the raw entry for the
        // ones ahead: only nextGate() carries counts, and the others are
        // just names and a level until you get there.
        const here = r.index === rank;
        const passed = r.index < rank;
        // The measured gate for the rank you are on, the raw entry for the ones
        // ahead: only nextGate() carries counts, and the rest are just a name
        // and a level until you reach them.
        const spec = ASCENSIONS.find((a) => a.rank === r.index);
        const gate = here ? nextGate(state) : spec;
        // The chains that belong to this stretch: unfinished ones sit with the
        // rank you are on, finished ones with the rank you were on when they
        // closed. Approximate on purpose — the map is a sense of distance, not
        // an audit.
        const mine = here ? chains.filter((c) => !c.done && !c.locked).slice(0, 4) : [];
        return raw(h`
          <div class="road__leg ${passed ? 'is-passed' : ''} ${here ? 'is-here' : ''}">
            <div class="gatepost">
              <div class="gatepost__node">
                ${passed ? raw(icon('check', { size: 20 }))
                  : here ? raw(h`<span class="gatepost__lv">${lv.level}</span>`)
                  : raw(icon('lock', { size: 17 }))}
              </div>
              <div class="gatepost__body">
                <div class="gatepost__name">${r.name}</div>
                <div class="gatepost__mean">${r.meaning}</div>
                <div class="gatepost__meta">
                  ${passed ? raw('Passed')
                    : here ? raw(h`Levels ${r.from}–${r.to}${lv.capped ? ' · sealed' : ''}`)
                    : spec ? raw(h`Seal at level ${spec.level}`) : raw(h`Levels ${r.from}–${r.to}`)}
                </div>
              </div>
              ${here && gate ? raw(h`
                <button class="gatepost__go" data-act="seal">
                  ${gate.done + (gate.xpReady ? 1 : 0)}/${gate.reqs.length + 1}
                </button>`) : raw('')}
            </div>

            ${mine.length ? raw(h`
              <div class="road__chains">
                ${mine.map((c, i) => raw(pathNode(c, chains.indexOf(c), c.progress.met)))}
              </div>`) : raw('')}
          </div>`);
      })}

      <div class="road__start">
        ${icon('sprout', { size: 15 })} Where you began
      </div>
    </div>`;
}

/* ---------------------------------------------------------------- sheets */
/* Everything that used to sit on the page, now one tap behind its tile.    */

/** The gate, in full: the seals, what each needs, and the way through. */
function openSealSheet() {
  const state = getState();
  const gate = nextGate(state);
  if (!gate) {
    sheet({ title: 'Muhsin', body: h`
      <p class="prose" style="margin:0">Every seal broken. There is no rank above this one and
      levels run on freely from here.</p>` });
    return;
  }

  const seals = [
    { label: `Reach level ${gate.level}`, have: Math.min(gate.xpHave, gate.level), n: gate.level,
      met: gate.xpReady, glyph: 'bolt' },
    ...gate.reqs.map((r) => ({
      label: r.label, have: Math.min(r.have, r.n), n: r.n, met: r.met,
      glyph: r.id === 'streak' ? 'flame' : r.id === 'trials' ? 'trophy'
        : r.id === 'automatic' ? 'sprout' : 'star',
    })),
  ];

  sheet({
    title: `The seal at ${gate.level}`,
    body: h`
      <div class="stack">
        <div class="sealhead">
          <div class="sealhead__t">${gate.name}</div>
          <div class="sealhead__m">${gate.meaning}</div>
          <p class="sealhead__b">${gate.blurb}</p>
        </div>
        <div class="seals">
          ${seals.map((s) => raw(h`
            <div class="seal ${s.met ? 'is-lit' : ''}">
              <div class="seal__disc">${icon(s.glyph, { size: 19 })}</div>
              <div class="seal__n">${s.have}<span>/${s.n}</span></div>
              <div class="seal__l">${s.label}</div>
            </div>`))}
        </div>
        <p class="muted" style="margin:0;font-size:.8rem;line-height:1.55;font-weight:600">
          Your level is held here until every seal is lit. Nothing is wasted meanwhile — XP keeps
          banking, so breaking through releases the levels all at once.
        </p>
      </div>`,
    footer: gate.ready
      ? h`<button class="btn btn--primary btn--block" data-do="ascend">Ascend to ${gate.name}</button>`
      : '',
    onMount: (el, close) => {
      el.querySelector('[data-do="ascend"]')?.addEventListener('click', () => {
        const res = doAscend();
        close();
        if (res) celebrateAscension(res, null);
        refresh();
      });
    },
  });
}

/** The trial: what is running, or what is on offer. */
function openTrialSheet() {
  const state = getState();
  const rec = activeTrial(state);

  if (!rec) {
    const pool = offered(state);
    const record = trialRecord(state);
    sheet({
      title: 'Take a trial',
      body: h`
        <div class="stack">
          <p class="prose" style="margin:0">
            One at a time, and you can decline. It is the only thing in this app you are able to
            fail — which is the only reason finishing one means anything. Stepping away costs
            nothing and is never recorded as a loss.
          </p>
          ${pool.length ? raw(h`<div class="stack-sm">
            ${pool.map((t) => { const tier = TIERS[t.tier]; const won = timesWon(t.id, state); return raw(h`
              <button class="trialopt toffer metal--${raw(tier.metal)}" data-take="${t.id}">
                <span class="toffer__tier metal--${raw(tier.metal)}"><b aria-hidden="true">\u25C6</b><i>${tier.days}d</i></span>
                <span class="grow">
                  <span class="trialopt__t">${t.title}${won ? raw(h` <em class="toffer__won">won ${won}×</em>`) : raw('')}</span>
                  <span class="trialopt__d">${t.desc}</span>
                  ${raw((() => { const m = todaysMove(t.metric, t.args || {}, state);
                    return m ? h`<span class="trialopt__on">${m}</span>` : ''; })())}
                </span>
                <span class="pricepill">+${t.xp}</span>
              </button>`); })}
          </div>`) : raw(h`<p class="muted" style="margin:0">
            Nothing on offer yet — trials appear once you hold habits they can measure.</p>`)}

          ${record.attempted ? raw(trialRecordBlock(record)) : raw('')}
        </div>`,
      onMount: (el, close) => {
        el.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-take]');
          if (!b) return;
          acceptTrial(b.dataset.take);
          sfx('claim'); haptic([16, 40, 22]);
          toast('Trial accepted · seven days', { icon: icon('flame'), tone: 'good' });
          close(); refresh();
        });
      },
    });
    return;
  }

  const spec = TRIAL_BY_ID[rec.id];
  const p = trialProgress(rec, state);
  const q = pace(rec, state);
  const left = daysLeft(rec);
  const over = isExpired(rec);
  const move = todaysMove(spec.metric, spec.args || {}, state);
  const tier = TIERS[spec.tier] || TIERS.standard;

  sheet({
    title: spec.title,
    body: h`
      <div class="stack">
        <p class="prose" style="margin:0">${spec.desc}</p>
        <div class="trial__meter">
          <div class="trial__bar"><i style="width:${(p.pct * 100).toFixed(1)}%"></i></div>
          <span class="trial__n">${p.raw} / ${p.target}</span>
        </div>
        <div class="paceline paceline--${raw(q.state)}">
          ${icon(q.state === 'won' ? 'checkCircle' : q.state === 'shortfall' ? 'half' : 'clock', { size: 15 })}
          <span>${paceLine(rec, state)}</span>
        </div>

        <div class="pdetail__terms">
          <div class="row-between"><span>Length</span><span class="metal--${raw(tier.metal)}"><b class="rankmark" aria-hidden="true">◆</b> ${tier.label} · ${tier.days} days</span></div>
          <div class="row-between"><span>Reward</span><span class="pricepill">+${spec.xp} XP</span></div>
          <div class="row-between"><span>Time left</span><span>${p.met ? 'Done' : over ? 'Expired' : `${left} day${left === 1 ? '' : 's'}`}</span></div>
          <div class="row-between"><span>If you miss it</span><span>Quarter reward past halfway</span></div>
          <div class="row-between"><span>If you step away</span><span>Nothing, ever</span></div>
        </div>
        ${move ? raw(h`<a class="doneon" href="#/today">
          ${icon('pointer', { size: 13 })}<span class="grow">${move}</span><span>on Today</span></a>`) : raw('')}
        <p class="muted" style="margin:0;font-size:.8rem;line-height:1.55;font-weight:600">${spec.note}</p>
      </div>`,
    footer: p.met || over
      ? h`<button class="btn ${p.met ? 'btn--primary' : 'btn--ghost'} btn--block" data-do="settle">
            ${p.met ? `Claim +${spec.xp} XP` : 'Close it out'}</button>`
      : h`<button class="btn btn--ghost btn--block" data-do="drop">Step away from it</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-do="settle"]')?.addEventListener('click', (ev) => {
        const res = settleTrial();
        close();
        if (res) reportTrial(res, ev.target);
        refresh();
      });
      el.querySelector('[data-do="drop"]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({
          title: 'Step away from this trial?',
          message: 'It costs nothing and it is not recorded as a loss. You can take another whenever you want one.',
          confirmLabel: 'Step away',
        });
        if (!ok) return;
        abandonTrial(); haptic(10); close(); refresh();
      });
    },
  });
}

function reportTrial(res, el) {
  if (res.outcome === 'won') {
    sfx('levelup'); haptic([20, 50, 25, 50, 40]);
    confetti({ count: 110, origin: el?.getBoundingClientRect?.() });
    toast(`${res.spec.title} · +${res.xp} XP`, { icon: icon('trophy'), tone: 'good', ms: 3400 });
  } else if (res.outcome === 'partial') {
    sfx('claim'); haptic([14, 30, 20]);
    toast(`${res.value} of ${res.target} · +${res.xp} XP for the part you held`, { ms: 3600 });
  } else {
    haptic(10);
    toast(`${res.value} of ${res.target}. Nothing lost — the days still count on your record.`, { ms: 3800 });
  }
}

/**
 * The collection.
 *
 * Wins only, grouped by tier, because a shelf of things you chose to do and
 * did is the reward this mechanic is actually paying out. Attempts that fell
 * short appear as "held partway" and never as failures — the promise is that
 * trying costs nothing, and a record that counted losses would quietly break
 * it.
 */
function trialRecordBlock(record) {
  return h`
    <details class="trec">
      <summary>
        <span class="grow">Your record</span>
        <span class="trec__score">${record.won} won \u00b7 ${record.xp.toLocaleString()} XP</span>
        <i class="qa__mark" aria-hidden="true">?</i>
      </summary>
      <div class="trec__body">
        ${TIER_ORDER.map((id) => { const t = record.byTier[id]; return raw(h`
          <div class="trec__tier">
            <div class="trec__head">
              <span class="metal--${raw(t.metal)}"><b class="rankmark" aria-hidden="true">\u25C6</b> ${t.label}</span>
              <span class="trec__n">${t.won}/${t.total}</span>
            </div>
            <div class="trec__grid">
              ${t.trials.map((x) => raw(h`
                <span class="trec__pip ${x.wins ? 'is-won' : x.locked ? 'is-locked' : ''}"
                      title="${x.title}${x.wins ? ` \u2014 won ${x.wins}\u00d7` : x.locked ? ' \u2014 win the seven-day one first' : ''}">
                  ${x.wins > 1 ? raw(h`<i>${x.wins}</i>`) : raw('')}
                </span>`))}
            </div>
          </div>`); })}
        ${record.attempted > record.won ? raw(h`
          <p class="trec__note">
            ${record.attempted - record.won} held partway. Those are not losses and are not
            counted as any \u2014 they are days you did that you would not otherwise have done.
          </p>`) : raw('')}
      </div>
    </details>`;
}

/** Choosing what to push on. */
function openPursuitSheet() {
  const state = getState();
  const rows = mainBoard(state).filter((r) => !r.locked && !r.done);
  sheet({
    title: 'What are you pushing on?',
    body: h`
      <div class="stack-sm">
        <p class="prose" style="margin:0 0 4px">
          One at a time, and its tiers pay half as much again. You can change it whenever you like —
          the others keep counting underneath, they just do not pay the premium.
        </p>
        ${rows.map((r) => raw(h`
          <button class="trialopt ${isPursued(r.quest.chain, state) ? 'is-on' : ''}"
                  data-pick="${r.quest.chain}">
            <span class="grow">
              <span class="trialopt__t">${r.quest.chainTitle}</span>
              <span class="trialopt__d">${r.quest.note}</span>
              ${raw((() => { const m = todaysMove(r.quest.goal.type, r.quest.goal, state);
                return m ? h`<span class="trialopt__on">${m}</span>` : ''; })())}
            </span>
            <span class="pricepill">${r.progress.value}/${r.progress.target}</span>
          </button>`))}
        ${state.game.pursuit ? raw(h`
          <button class="btn btn--ghost btn--block" data-clear style="margin-top:6px">
            Stop pushing on anything</button>`) : raw('')}
      </div>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const pick = ev.target.closest('[data-pick]');
        if (pick) {
          setPursuit(pick.dataset.pick);
          sfx('claim'); haptic([14, 30, 20]); close(); refresh(); return;
        }
        if (ev.target.closest('[data-clear]')) { setPursuit(null); haptic(10); close(); refresh(); }
      });
    },
  });
}

/** Every chain, with the claimable ones first. */
function openChainsSheet() {
  const state = getState();
  const rows = mainBoard(state);
  const claimable = rows.filter((r) => !r.done && !r.locked && r.progress.met);
  const rest = rows.filter((r) => !claimable.includes(r));

  sheet({
    title: 'Every chain',
    body: h`
      <div class="stack">
        <p class="prose" style="margin:0">
          These are not tasks. They watch what you already do and pay out when you cross a number —
          you never start one and you cannot fail one. The only thing to do here is claim one when
          it lights up.
        </p>
        ${claimable.length ? raw(h`<div class="path">
          ${raw(claimable.map((row) => pathNode(row, rows.indexOf(row), true)).join(''))}
        </div>`) : raw('')}
        <div class="path">${raw(rest.map((row, i) => pathNode(row, i, false)).join(''))}</div>
      </div>`,
  });
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

/** The whole ladder, behind the crest. */
function openClimbSheet() {
  sheet({ title: 'The climb', body: h`<div class="stack">${raw(ladderList(getState()))}</div>` });
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
