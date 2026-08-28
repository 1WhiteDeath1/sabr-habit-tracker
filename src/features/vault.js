// vault.js — one screen that explains the whole economy.
//
// Before this existed the wallet was a strip inside the habits screen and the
// only thing with a price was a habit, so the economy read as a tax on adding
// habits rather than as the spine of the game. This is the spine made visible:
// everything you have earned, everything it is currently holding up, everything
// you could switch on today, and everything still ahead of you — in that order,
// on one screen, with the arithmetic shown rather than asserted.

import { h, raw, actions, haptic, toast, confirmSheet, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { wallet, DIFFICULTY, difficultyOf, costOf } from '../core/economy.js';
import { allUnlockStatuses, buyUnlock, sellUnlock, unlockStatus } from '../core/unlocks.js';
import { ALWAYS_FREE } from '../data/unlocks.js';
import { slotStatus } from '../core/comeback.js';
import { playerLevel } from '../core/game.js';
import { CATEGORIES } from '../core/schema.js';
import { icon } from '../ui/icons.js';
import { refresh, go } from '../core/router.js';
import { sfx } from '../core/audio.js';
import { confetti } from '../ui/confetti.js';

const n = (v) => Number(v || 0).toLocaleString();

export const vaultScreen = {
  render() {
    const state = getState();
    const w = wallet(state);
    const st = slotStatus(state);
    const lv = playerLevel(state);
    const rows = allUnlockStatuses(state);

    const ownedRows = rows.filter((r) => r.phase === 'owned');
    const openRows = rows.filter((r) => r.phase === 'buyable' || r.phase === 'broke');
    const aheadRows = rows.filter((r) => r.phase === 'locked');
    const live = state.habits.filter((x) => !x.archived);

    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
          <div class="eyebrow" style="margin-top:8px">The wallet</div>
          <h1>What your XP is holding</h1>
        </header>

        <div class="stack">
          ${raw(balanceCard(w, lv))}

          <div class="card">
            ${raw(qaRow('Nothing here is ever spent',
              'XP is capacity, not currency. Everything you are running — every habit, every module — holds some of it while it is on, and hands every point back the moment you turn it off. Your level runs on lifetime XP and never falls, so there is no way to make a choice here that costs you a level or a slot. That is why it is safe to try something and change your mind.'))}
          </div>

          ${raw(committedCard(state, live, w, st))}

          ${openRows.length ? raw(h`
            <div class="section-title"><span>Available now</span></div>
            <div class="stack-sm">${openRows.map((r) => raw(unlockRow(r)))}</div>`) : raw('')}

          ${aheadRows.length ? raw(h`
            <div class="section-title"><span>Further up</span></div>
            <div class="stack-sm">${aheadRows.map((r) => raw(unlockRow(r)))}</div>`) : raw('')}

          ${ownedRows.length ? raw(h`
            <div class="section-title"><span>Switched on</span></div>
            <div class="stack-sm">${ownedRows.map((r) => raw(unlockRow(r)))}</div>`) : raw('')}

          <div class="section-title"><span>Never for sale</span></div>
          <div class="card vault__free">
            <p class="prose" style="margin:0 0 10px">
              These are free permanently and will never appear above. Charging you
              to reach the help, or to see the truth about your own week, would be
              the worst thing this app could do.
            </p>
            ${ALWAYS_FREE.map((f) => raw(h`
              <div class="vault__freerow">${icon(f.icon, { size: 16 })}<span>${f.label}</span></div>`))}
          </div>
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      buy: (el, ds) => {
        const res = buyUnlock(ds.id);
        if (!res.ok) {
          toast(res.reason === 'balance'
            ? `${res.short} XP short. Archive a habit, or earn a little more.`
            : `Opens at level ${res.opensAt}.`, { tone: 'warn' });
          return;
        }
        sfx('claim');
        haptic([14, 40, 20]);
        confetti({ count: 40, power: 0.7 });
        toast(`${res.def.label} unlocked · ${res.cost} XP committed`, { tone: 'good' });
        refresh();
      },

      sell: async (el, ds) => {
        const st = unlockStatus(ds.id);
        const ok = await confirmSheet({
          title: `Turn off ${st.def.label}?`,
          message: st.paid
            ? `You get all ${st.paid} XP back. Nothing is deleted — switch it on again whenever you like and it picks up exactly where it was.`
            : 'Nothing is deleted, and switching it on again later costs nothing, because you were never charged for it.',
          confirmLabel: 'Turn it off',
        });
        if (!ok) return;
        const res = sellUnlock(ds.id);
        if (res.ok) {
          haptic(12);
          toast(res.refund ? `${res.refund} XP back in the budget` : 'Turned off', { tone: 'good' });
          refresh();
        }
      },

      open: (el, ds) => go(String(ds.href || '').replace(/^#\//, '')),
      habits: () => go('habits'),
    });
  },
};

/* --------------------------------------------------------------- pieces */

/**
 * The balance, and the arithmetic behind it.
 *
 * The bar is segmented rather than a single fill so the two kinds of commitment
 * are visible at a glance: habits are the point of the app, modules are the app
 * itself, and seeing which one is eating the budget is the entire reason to
 * look at this screen.
 */
function balanceCard(w, lv) {
  const pctH = w.earned ? (w.onHabits / w.earned) * 100 : 0;
  const pctU = w.earned ? (w.onUnlocks / w.earned) * 100 : 0;

  return h`
    <div class="card vaultcard">
      <div class="vaultcard__top">
        <div>
          <div class="vaultcard__k">Free to commit</div>
          <div class="vaultcard__n">${n(w.balance)}<span>XP</span></div>
        </div>
        <div class="vaultcard__lv">
          <span>${icon('star', { size: 14 })} Level ${lv.level}</span>
          <em>${n(lv.need - lv.into)} to next</em>
        </div>
      </div>

      <div class="vaultbar">
        <i class="vaultbar__h" style="width:${pctH.toFixed(1)}%"></i>
        <i class="vaultbar__u" style="width:${pctU.toFixed(1)}%"></i>
      </div>

      <div class="vaultlegend">
        <span><i class="k k--h"></i>${n(w.onHabits)} on habits</span>
        <span><i class="k k--u"></i>${n(w.onUnlocks)} on modules</span>
        <span><i class="k k--f"></i>${n(w.balance)} free</span>
      </div>

      <div class="vaultcard__sum">
        ${n(w.earned)} earned all time · ${n(w.committed)} committed
      </div>
    </div>`;
}

/** Line by line, what is holding the committed half. */
function committedCard(state, live, w, st) {
  const owned = allUnlockStatuses(state).filter((r) => r.phase === 'owned');

  return h`
    <div class="card">
      <div class="row-between" style="margin-bottom:4px">
        <span class="card__title">Where it is going</span>
        <span class="pill">${st.used} of ${st.total} slots</span>
      </div>

      ${live.length ? raw(h`
        <div class="vault__grp">Habits</div>
        ${live.map((hab) => raw(h`
          <button class="vault__line" data-act="habits">
            <i class="vault__dot" style="background:${CATEGORIES[hab.category]?.color || 'var(--muted)'}"></i>
            <span class="grow">${hab.title}</span>
            <span class="vault__tier">${DIFFICULTY[difficultyOf(hab)].label}</span>
            <span class="pricepill">${costOf(hab)}</span>
          </button>`))}`)
      : raw(h`<p class="muted" style="margin:8px 0;font-size:.85rem;font-weight:600">
            No habits yet — the whole budget is free.
          </p>`)}

      ${owned.length ? raw(h`
        <div class="vault__grp">Modules</div>
        ${owned.map((r) => raw(h`
          <button class="vault__line" data-act="open" data-href="${r.def.href}">
            <i class="vault__dot vault__dot--u"></i>
            <span class="grow">${r.def.label}</span>
            ${r.free ? raw('<span class="vault__tier">kept</span>') : raw('')}
            <span class="pricepill">${r.paid}</span>
          </button>`))}`) : raw('')}

      <div class="vault__total">
        <span class="grow">Committed</span><strong>${n(w.committed)} XP</strong>
      </div>
      ${st.nextAt ? raw(h`<p class="muted" style="margin:9px 0 0;font-size:.8rem;font-weight:600">
          The next habit slot opens at level ${st.nextAt} — and the budget, not the
          slot, is usually what decides whether you can fill it.
        </p>`) : raw('')}
    </div>`;
}

/** One shelf row, in whichever of the four states it is in. */
function unlockRow(r) {
  const d = r.def;
  const cta = {
    buyable: h`<button class="btn btn--primary btn--sm" data-act="buy" data-id="${d.id}">Unlock · ${d.cost}</button>`,
    broke:   h`<span class="unlock__short">${r.short} XP short</span>`,
    locked:  h`<span class="unlock__short">Level ${d.level}</span>`,
    owned:   h`<button class="btn btn--ghost btn--sm" data-act="sell" data-id="${d.id}">Turn off</button>`,
  }[r.phase];

  return h`
    <div class="card unlock is-${r.phase}">
      <div class="unlock__head">
        <span class="unlock__ico">${icon(r.phase === 'locked' ? 'lock' : d.icon, { size: 20 })}</span>
        <span class="grow">
          <span class="unlock__name">${d.label}</span>
          <span class="unlock__tag">${d.tag}</span>
        </span>
        ${raw(cta)}
      </div>
      <p class="unlock__blurb">${r.phase === 'locked' ? d.teaser : d.blurb}</p>
      ${r.phase === 'owned'
        ? raw(h`<a class="unlock__go" href="${d.href}">Open it ›</a>`)
        : raw(h`<div class="unlock__qa">${raw(qaRow('Is this worth it?', d.why))}</div>`)}
    </div>`;
}
