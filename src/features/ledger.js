// ledger.js (screen) — the muhasabah book.
//
// Reachable from Today, from the night ritual, and from Me. The tone rules are
// enforced in core/ledger.js; this file's job is to make the honest thing the
// easy thing — two taps to log, and a correction field that is the real point.

import { h, raw, actions, haptic, toast, sheet, confirmSheet, xpBurst, bar, qaRow, qaTitle } from '../ui/dom.js';
import { getState } from '../core/store.js';
import {
  OMISSIONS, COMMISSIONS, KIND_LABEL, logEntry, removeEntry, resolveEntry,
  recentEntries, ledgerPatterns, clearDays, entriesFor, LEDGER_XP,
} from '../core/ledger.js';
import { todayKey, prettyDay, addDays } from '../core/dates.js';
import { passageFor } from '../data/scripture.js';
import { passageCard, evidenceCard } from '../ui/widgets.js';
import { refresh } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';

export const ledgerScreen = {
  render() {
    const state = getState();
    const key = todayKey();
    const pat = ledgerPatterns(state);
    const today = entriesFor(key, state);
    const recent = recentEntries(40, state).filter((e) => e.day !== key);
    const clear = clearDays(30, state);

    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/today" class="muted" style="font-size:.85rem">‹ Today</a>
          <div class="eyebrow" style="margin-top:8px">Muhasabah</div>
          <h1>The ledger</h1>
        </header>

        <div class="stack">
          <div class="card card--info" style="padding:12px 14px">
            ${raw(qaRow('Nothing here subtracts anything',
              `Every entry earns +${LEDGER_XP} XP, because the only version of this book that helps is a true one. You are looking for the shape of the problem, not keeping score against yourself.`))}
          </div>

          <div class="statgrid">
            <div class="stat"><div class="stat__n">${clear}</div><div class="stat__l">clear days / 30</div></div>
            <div class="stat"><div class="stat__n">${pat.thisWeek}</div><div class="stat__l">this week</div></div>
            <div class="stat"><div class="stat__n">${pat.delta > 0 ? '+' : ''}${pat.delta}</div><div class="stat__l">vs last week</div></div>
          </div>

          <div class="row" style="gap:10px">
            <button class="btn btn--ghost grow" data-act="add" data-type="omission">Didn’t do</button>
            <button class="btn btn--ghost grow" data-act="add" data-type="commission">Did wrong</button>
          </div>

          ${pat.unresolved ? raw(h`
            <div class="card card--warn">
              ${raw(qaTitle(h`${icon('wrench')} ${pat.unresolved} correction${pat.unresolved > 1 ? 's' : ''} still open`,
                'Writing the correction is half. Running it is the other half — mark them off below when you have.'))}
            </div>`) : raw('')}

          <div class="section-title"><span>Today</span></div>
          ${today.length
            ? raw(h`<div class="stack-sm">${today.map((e) => raw(entryCard(e)))}</div>`)
            : raw(h`
              <div class="card" style="padding:12px 14px">
                ${raw(qaRow('Nothing logged today',
                  'That is either a clear day or an unexamined one — you are the only person who knows which.'))}
              </div>`)}

          ${pat.total >= 3 ? raw(patternCard(pat)) : raw(h`
            <div class="card">
              ${raw(qaTitle(h`${icon('chart')} Patterns · ${pat.total}/3`,
                'After a few entries this shows which things actually recur and what hours they cluster in.'))}
            </div>`)}

          <div class="card">${raw(passageCard(passageFor('review', key), { state }))}</div>

          <div class="card">
            <p class="prose" style="margin:0">
              “Take account of yourselves before you are taken to account, and weigh your deeds before they are
              weighed for you.” — attributed to ‘Umar ibn al-Khattab (RA), reported by at-Tirmidhi.
            </p>
          </div>

          ${raw(evidenceCard('selfMonitoring', { full: true }))}

          ${recent.length ? raw(h`
            <div class="section-title"><span>Earlier</span></div>
            <div class="stack-sm">${recent.slice(0, 20).map((e) => raw(entryCard(e, true)))}</div>`) : raw('')}
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      add: (el, ds) => openEntrySheet(ds.type),
      resolve: (el, ds) => {
        const xp = resolveEntry(ds.id);
        if (xp) { haptic([14, 30, 20]); xpBurst(xp, el, 'var(--purple)'); toast('Correction run. That is the part that counts.', { tone: 'good' }); }
        refresh();
      },
      del: async (el, ds) => {
        const ok = await confirmSheet({ title: 'Delete this entry?', message: 'It disappears from your patterns too.', confirmLabel: 'Delete', tone: 'danger' });
        if (ok) { removeEntry(ds.id); refresh(); }
      },
    });
  },
};

/* ------------------------------------------------------------ fragments */

function entryCard(e, showDay = false) {
  const tone = e.type === 'omission' ? 'gold' : 'danger';
  return h`
    <div class="card" style="border-color:${raw(e.type === 'omission' ? 'var(--gold)' : 'var(--red)')}">
      <div class="row" style="align-items:flex-start">
        <div class="grow">
          <span class="pill pill--${raw(tone)}">${e.type === 'omission' ? 'Left undone' : 'Did wrong'}</span>
          <div style="font-weight:800;margin-top:7px">${KIND_LABEL[e.kind] || e.kind}</div>
          ${e.note ? raw(h`<div class="dim" style="font-size:.87rem;margin-top:4px;line-height:1.45;font-weight:500">${e.note}</div>`) : raw('')}
          ${showDay ? raw(h`<div class="muted" style="font-size:.74rem;margin-top:6px;font-weight:700">${prettyDay(e.day)}</div>`) : raw('')}
        </div>
        <button class="iconbtn" data-act="del" data-id="${e.id}" aria-label="Delete entry">&times;</button>
      </div>
      ${e.correction ? raw(h`
        <div style="margin-top:11px;padding-top:11px;border-top:2px solid var(--border)">
          <div class="muted" style="font-size:.7rem;letter-spacing:.08em;font-weight:800;text-transform:uppercase">Correction</div>
          <div style="font-size:.9rem;font-weight:700;margin-top:3px">${e.correction}</div>
          ${e.resolved
            ? raw(`<span class="pill pill--accent" style="margin-top:9px">${icon('check', { size: 13 })} Done</span>`)
            : raw(h`<button class="btn btn--primary btn--sm" style="margin-top:10px" data-act="resolve" data-id="${e.id}">I did it · +20 XP</button>`)}
        </div>`) : raw('')}
    </div>`;
}

function patternCard(pat) {
  const max = Math.max(...pat.hours, 1);
  const fmtHour = (hh) => `${((hh % 12) || 12)}${hh < 12 ? 'am' : 'pm'}`;
  const peak = pat.hours.indexOf(Math.max(...pat.hours));

  return h`
    <div class="card">
      <div class="card__title">${icon('chart')} Patterns</div>
      <p class="prose">
        ${pat.delta < 0
          ? raw(h`Down <strong>${Math.abs(pat.delta)}</strong> on last week. Whatever you changed, keep doing it.`)
          : pat.delta > 0
            ? raw(h`Up <strong>${pat.delta}</strong> on last week. Look at the hours below before you look at yourself.`)
            : raw('Level with last week.')}
        ${pat.hours[peak] ? raw(h` Most of it lands around <strong>${fmtHour(peak)}</strong>.`) : raw('')}
      </p>
      <div class="row wrap" style="gap:6px;margin:10px 0 14px">
        ${pat.top.map((t) => raw(h`<span class="pill pill--${raw(t.omission ? 'gold' : 'danger')}">${t.label} · ${t.count}</span>`))}
      </div>
      <div class="row" style="align-items:flex-end;gap:2px;height:52px">
        ${Array.from({ length: 24 }, (_, hh) => raw(
          `<div style="flex:1;border-radius:3px;background:${pat.hours[hh] ? 'var(--red)' : 'var(--border)'};opacity:${pat.hours[hh] ? 0.4 + 0.6 * (pat.hours[hh] / max) : 1};height:${Math.max(5, (pat.hours[hh] / max) * 52)}px"></div>`))}
      </div>
      <div class="row-between muted" style="font-size:.68rem;margin-top:5px;font-weight:700"><span>12am</span><span>12pm</span><span>11pm</span></div>
    </div>`;
}

/* ---------------------------------------------------------------- sheet */

export function openEntrySheet(type = 'omission', onDone) {
  const list = type === 'omission' ? OMISSIONS : COMMISSIONS;
  let chosen = null;

  sheet({
    title: type === 'omission' ? 'What did you leave undone?' : 'What did you do?',
    size: 'full',
    body: h`
      <div class="stack">
        <div class="row wrap" style="gap:8px">
          ${list.map((k) => raw(h`<button class="chip" data-kind="${k.id}">${k.label}</button>`))}
        </div>

        <label class="field" style="margin-top:6px">
          <span>What happened (optional)</span>
          <textarea id="lg-note" placeholder="Flat and factual. Where were you, what came just before it."></textarea>
          <span class="hint">Describe the situation, not your character. "I had my phone in bed" is useful; "I am lazy" is not.</span>
        </label>

        <label class="field">
          <span>One correction — an if–then</span>
          <textarea id="lg-fix" placeholder="If I am still awake at 11:30, then the phone goes on the kitchen counter."></textarea>
          <span class="hint">This is the whole reason the entry exists. Make it about the situation, not about trying harder.</span>
        </label>

        ${raw(evidenceCard('abstinenceViolation', { full: true }))}
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Log it · +${LEDGER_XP} XP</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const chip = ev.target.closest('[data-kind]');
        if (chip) {
          chosen = chip.dataset.kind;
          el.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('is-on', b === chip));
          haptic(8);
          return;
        }
        if (!ev.target.closest('[data-save]')) return;
        if (!chosen) { toast('Pick what it was first', { tone: 'warn' }); return; }
        const xp = logEntry({
          kind: chosen,
          note: el.querySelector('#lg-note').value.trim(),
          correction: el.querySelector('#lg-fix').value.trim(),
        });
        close();
        sfx('note');
        haptic([14, 30, 20]);
        toast(`Logged honestly · +${xp} XP`, { icon: icon('ledger'), tone: 'good' });
        if (onDone) onDone(); else refresh();
      });
    },
  });
}
