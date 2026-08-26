// gate.js — what a locked module shows instead of itself.
//
// A locked screen is not a dead end and must never read like one. It is the
// clearest advert this app has: here is exactly what this does, here is what it
// costs, here is why you might not want it at all, and here is the one number
// standing between you and it. A goal you can see the price of is a goal; a
// greyed-out tab with a padlock is just an annoyance.
//
// Used by Focus, the night ritual and University, so all three lock the same
// way and the rule only has to be learned once.

import { h, raw, haptic, toast, qaRow } from '../ui/dom.js';
import { unlockStatus, buyUnlock } from '../core/unlocks.js';
import { icon } from '../ui/icons.js';
import { refresh, go } from '../core/router.js';
import { sfx } from '../core/audio.js';
import { confetti } from '../ui/confetti.js';

/**
 * The locked screen for one module.
 * Returns '' when it is unlocked, so a caller can write:
 *
 *   const gate = gateScreen('focus');
 *   if (gate) return gate;
 */
export function gateScreen(id, { back = '#/today', backLabel = 'Today' } = {}) {
  const st = unlockStatus(id);
  if (st.phase === 'owned' || st.phase === 'missing') return '';
  const d = st.def;

  const cta = {
    buyable: h`
      <button class="btn btn--primary btn--lg btn--block" data-act="gatebuy" data-id="${id}">
        Unlock for ${d.cost} XP
      </button>
      <p class="gate__after">Leaves you ${(st.balance - d.cost).toLocaleString()} XP free. Turn it off any time and every point comes back.</p>`,

    broke: h`
      <button class="btn btn--lg btn--block" disabled>${st.short} XP short</button>
      <p class="gate__after">You have ${st.balance.toLocaleString()} free of the ${d.cost} this holds.
        Earn a little more, or archive a habit you are not really running — that refunds its cost in full.</p>`,

    locked: h`
      <button class="btn btn--lg btn--block" disabled>Opens at level ${d.level}</button>
      <p class="gate__after">You are level ${st.level}. ${st.levelsAway === 1
        ? 'One more level.'
        : `${st.levelsAway} levels to go.`} Every habit you tick moves it closer.</p>`,
  }[st.phase];

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="${back}" class="muted" style="font-size:.85rem">‹ ${backLabel}</a>
      </header>

      <div class="gate">
        <div class="gate__badge is-${st.phase}">
          ${icon(st.phase === 'locked' ? 'lock' : d.icon, { size: 40 })}
        </div>
        <div class="eyebrow">${d.tag}</div>
        <h1 class="gate__title">${d.label}</h1>
        <p class="gate__blurb">${d.blurb}</p>

        <div class="gate__cta">${raw(cta)}</div>

        <div class="card gate__why">
          ${raw(qaRow('Is this worth it?', d.why))}
        </div>

        <div class="card gate__rule">
          ${raw(qaRow('Why a feature costs XP at all',
            'Because attention is the thing actually in short supply, and an app that keeps adding screens for free is quietly spending yours. Everything optional here holds part of the same budget your habits draw on, so switching this on is a real trade against a habit — which is the honest version of the choice you were making anyway. Nothing is ever burned: turning it off refunds the whole cost, and your level runs on lifetime XP so it can never fall.'))}
        </div>

        <a class="gate__vault" href="#/vault">See the whole wallet ›</a>
      </div>
    </div>`;
}

/**
 * Bind the unlock button. Safe to call on every mount — it does nothing when
 * the screen it is attached to is not a gate.
 */
export function gateMount(root) {
  const btn = root.querySelector('[data-act="gatebuy"]');
  if (!btn) return false;
  btn.addEventListener('click', () => {
    const res = buyUnlock(btn.dataset.id);
    if (!res.ok) {
      toast(res.reason === 'balance' ? `${res.short} XP short` : `Opens at level ${res.opensAt}`, { tone: 'warn' });
      return;
    }
    sfx('claim');
    haptic([14, 40, 20]);
    confetti({ count: 46, power: 0.75 });
    toast(`${res.def.label} unlocked`, { tone: 'good' });
    refresh();
  });
  return true;
}

/**
 * The inline version, for a module that lives inside another screen rather than
 * on a route of its own — the stake on Habits, the voice note in Settings.
 * Same rules, one card instead of a page.
 */
export function gateCard(id) {
  const st = unlockStatus(id);
  if (st.phase === 'owned' || st.phase === 'missing') return '';
  const d = st.def;

  const cta = {
    buyable: h`<button class="btn btn--primary btn--sm" data-act="gatebuy" data-id="${id}">Unlock · ${d.cost} XP</button>`,
    broke:   h`<span class="unlock__short">${st.short} XP short</span>`,
    locked:  h`<span class="unlock__short">Level ${d.level}</span>`,
  }[st.phase];

  return h`
    <div class="card unlock unlock--inline is-${st.phase}" style="margin-bottom:10px">
      <div class="unlock__head">
        <span class="unlock__ico">${icon(st.phase === 'locked' ? 'lock' : d.icon, { size: 19 })}</span>
        <span class="grow">
          <span class="unlock__name">${d.label}</span>
          <span class="unlock__tag">${d.tag}</span>
        </span>
        ${raw(cta)}
      </div>
      <p class="unlock__blurb">${st.phase === 'locked' ? d.teaser : d.blurb}</p>
      <div class="unlock__qa">${raw(qaRow('Is this worth it?', d.why))}</div>
    </div>`;
}
