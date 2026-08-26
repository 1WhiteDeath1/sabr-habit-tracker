// shield.js — the recovery section.
//
// Tone matters more here than anywhere else in the app. Nothing on this screen
// calls you disgusting, nothing counts down from a number you can lose, and the
// biggest button is the one you press *before* something happens rather than
// after. See core/recovery.js for why each of those is a deliberate choice.

import { h, raw, actions, haptic, toast, sheet, confirmSheet, bar, qaRow, qaTitle } from '../ui/dom.js';
import { getState } from '../core/store.js';
import {
  recoveryStats, startRecovery, patterns, GUARDS, setGuard, guardScore,
  addPlan, removePlan, TRIGGERS,
} from '../core/recovery.js';
import { humanDuration } from '../core/dates.js';
import { passageFor } from '../data/scripture.js';
import { passageCard, evidenceCard } from '../ui/widgets.js';
import { refresh } from '../core/router.js';
import { openSos, openRelapseFlow } from './sos.js';
import { icon } from '../ui/icons.js';

export const shieldScreen = {
  render() {
    const state = getState();
    if (!state.recovery.enabled) return renderIntro();

    const s = recoveryStats(state);
    const pat = patterns(state);
    const guards = guardScore(state);

    return h`
      <div class="screen">
        <header class="screen__head">
          <div class="eyebrow">Shield</div>
          <h1>Ghadd al-basar</h1>
        </header>

        <div class="stack">
          <div class="card shieldhero">
            <div class="shieldhero__count">${s.days}</div>
            <div class="shieldhero__unit">days clear</div>
            <div class="shieldhero__sub">${humanDuration(s.ms)} · since ${new Date(s.since).toLocaleDateString()}</div>
          </div>

          <button class="sosbtn" data-act="sos">${icon('wave')}&nbsp; I am having an urge</button>
          <p class="muted center" style="font-size:.78rem;margin:-4px 0 0">
            Press this <em>before</em> anything happens. That is what it is for.
          </p>

          <div class="statgrid">
            <div class="stat"><div class="stat__n">${s.best}</div><div class="stat__l">best run</div></div>
            <div class="stat"><div class="stat__n">${s.lifetime}</div><div class="stat__l">lifetime days</div></div>
            <div class="stat"><div class="stat__n">${s.urgesSurvived}</div><div class="stat__l">urges beaten</div></div>
          </div>

          ${s.winRate != null ? raw(h`
            <div class="card" style="padding:12px 14px">
              ${raw(qaRow(h`${Math.round(s.winRate * 100)}% of urges ridden out`,
                'Your lifetime clean days have never gone down and never will. A lapse ends a streak; it does not delete your history.'))}
            </div>`) : raw('')}

          ${pat.sampleSize >= 3 ? raw(patternCard(pat)) : raw(h`
            <div class="card">
              ${raw(qaTitle(h`${icon('chart')} Your patterns · ${pat.sampleSize}/3`,
                'Log a few urges and lapses and this becomes the most useful screen in the app — it will tell you which state and which hours are actually doing the damage.'))}
            </div>`)}

          <div class="section-title"><span>Defences</span><span class="mono muted" style="text-transform:none">${guards.on}/${guards.total}</span></div>
          <div class="card">
            <div style="margin-bottom:12px">${bar(guards.pct, { color: 'var(--violet)' })}</div>
            <div class="stack-sm">
              ${GUARDS.map((g) => raw(h`
                <label class="switch" style="padding:7px 0">
                  <span style="font-size:.9rem;line-height:1.4">${g.label}</span>
                  <input type="checkbox" data-guard="${g.id}" ${state.recovery.guards[g.id] ? 'checked' : ''}>
                </label>`))}
            </div>
          </div>
          ${raw(evidenceCard('environmentDesign', { full: true }))}

          <div class="section-title"><span>If–then plans</span>
            <button class="btn btn--ghost btn--sm" data-act="addplan">Add</button></div>
          ${state.recovery.plans.length ? raw(h`
            <div class="stack-sm">
              ${state.recovery.plans.map((p) => raw(h`
                <div class="card row" style="align-items:flex-start">
                  <div class="grow">
                    <div class="muted" style="font-size:.72rem;letter-spacing:.08em;font-weight:700">IF</div>
                    <div style="font-size:.92rem">${p.trigger}</div>
                    <div class="muted" style="font-size:.72rem;letter-spacing:.08em;font-weight:700;margin-top:6px">THEN</div>
                    <div style="font-size:.92rem;font-weight:600">${p.thenDo}</div>
                    ${p.usedCount ? raw(h`<div class="muted" style="font-size:.72rem;margin-top:6px">used ${p.usedCount}×</div>`) : raw('')}
                  </div>
                  <button class="iconbtn" data-act="delplan" data-id="${p.id}" aria-label="Delete plan">&times;</button>
                </div>`))}
            </div>`) : raw(h`
            <div class="card" style="padding:12px 14px">
              ${raw(qaRow('None yet — write three',
                'One for late at night, one for boredom, one for after an argument. This is the highest-leverage ten minutes available to you right now.'))}
            </div>`)}
          ${raw(evidenceCard('implementationIntentions', { full: true }))}

          <div class="section-title"><span>Hold on to this</span></div>
          <div class="card">${raw(passageCard(passageFor('shield', String(s.days)), { state }))}</div>

          <div class="section-title"><span>If it slipped</span></div>
          <button class="btn btn--ghost btn--sm btn--block" data-act="relapse">Log a lapse</button>
          <div class="card" style="padding:10px 14px;margin-top:8px">
            ${raw(qaRow('Nothing is ever deducted',
              'Honest logging is the whole point of this section. Your lifetime total is banked first, and the pattern view only works if what is in it is true.'))}
          </div>

          <div class="card" style="margin-top:14px">
            <div class="card__title">${icon('hands')} When an app is not enough</div>
            <p class="prose" style="margin:0">
              If this is affecting your work, sleep or relationships and self-directed effort has not moved it,
              that is a normal point at which to get real help. Compulsive sexual behaviour is a recognised
              clinical condition (ICD-11 6C72), and CBT- and ACT-based therapy have evidence behind them.
              Wanting help is not weakness — it is the same logic as seeing a doctor for a broken bone.
            </p>
          </div>
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      sos: () => openSos(),
      relapse: () => openRelapseFlow(),
      addplan: () => openPlanSheet(),
      delplan: async (el, ds) => {
        const ok = await confirmSheet({ title: 'Delete this plan?', message: 'It will be removed from the SOS screen too.', confirmLabel: 'Delete', tone: 'danger' });
        if (ok) { removePlan(ds.id); refresh(); }
      },
      start: () => { startRecovery(); haptic([20, 50, 20]); toast('Day one. The counter has started.', { tone: 'good' }); refresh(); },
    });

    root.addEventListener('change', (ev) => {
      const g = ev.target.closest('[data-guard]');
      if (!g) return;
      setGuard(g.dataset.guard, g.checked);
      haptic(10);
      const score = guardScore();
      if (g.checked) toast(`Defence up — ${score.on}/${score.total}`, { tone: 'good' });
    });
  },
};

function renderIntro() {
  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">Shield</div>
        <h1>Guarding the gaze</h1>
      </header>
      <div class="stack">
        <div class="card">
          <p class="prose">
            This section is for breaking a pornography habit. It is built on relapse-prevention practice
            rather than on shame, because shame is the thing that turns one bad night into a bad month.
          </p>
          <p class="prose">Three rules it runs on, and it will not break them:</p>
          <ul class="prose" style="padding-left:20px;margin:0">
            <li><strong>Your lifetime clean days never go down.</strong> A lapse ends a streak. It does not delete your history.</li>
            <li><strong>Logging honestly earns XP.</strong> If truth costs you points, you stop telling it.</li>
            <li><strong>The urge is the opponent, not you.</strong> Every urge you outlast is logged as a win, because it is one.</li>
          </ul>
        </div>

        ${raw(evidenceCard('urgeSurfing', { full: true }))}
        ${raw(evidenceCard('abstinenceViolation', { full: true }))}

        <div class="card">${raw(passageCard(passageFor('shield', 'intro'), {}))}</div>

        <button class="btn btn--primary btn--lg btn--block" data-act="start">Start the counter</button>
        <p class="muted center" style="font-size:.78rem">Everything you enter here stays on this phone. Nothing is uploaded anywhere.</p>
      </div>
    </div>`;
}

function patternCard(pat) {
  const band = pat.riskiestBand;
  const fmtHour = (hh) => `${((hh % 12) || 12)}${hh < 12 ? 'am' : 'pm'}`;
  const max = Math.max(...pat.hourCount, 1);

  return h`
    <div class="card">
      <div class="card__title">${icon('chart')} Your patterns</div>
      ${band ? raw(h`<p class="prose">Your highest-risk window is <strong>${fmtHour(band.from)}–${fmtHour(band.to)}</strong>.
        Put something in that gap on purpose, before it arrives.</p>`) : raw('')}
      ${pat.topTriggers.length ? raw(h`
        <div class="row wrap" style="gap:6px;margin:10px 0 12px">
          ${pat.topTriggers.map((t) => raw(h`<span class="pill pill--danger">${t.label} · ${t.count}</span>`))}
        </div>`) : raw('')}
      <div class="row" style="align-items:flex-end;gap:2px;height:48px">
        ${Array.from({ length: 24 }, (_, hh) => raw(
          `<div style="flex:1;background:${pat.hourCount[hh] ? 'var(--danger)' : 'var(--surface-3)'};opacity:${pat.hourCount[hh] ? 0.35 + 0.65 * (pat.hourCount[hh] / max) : 1};height:${Math.max(4, (pat.hourCount[hh] / max) * 48)}px;border-radius:2px"></div>`))}
      </div>
      <div class="row-between muted" style="font-size:.66rem;margin-top:4px"><span>12am</span><span>12pm</span><span>11pm</span></div>
      <p class="muted" style="font-size:.76rem;margin:10px 0 0">Based on ${pat.sampleSize} logged events.</p>
    </div>`;
}

function openPlanSheet() {
  sheet({
    title: 'New if–then plan',
    body: h`
      <div class="stack">
        <p class="prose">Write the situation exactly as it actually happens, then the single physical action you will take.
        Not "I will resist" — something your body does.</p>
        <label class="field">
          <span>IF this happens…</span>
          <input type="text" id="pl-trigger" placeholder="I am in bed with my phone after midnight">
        </label>
        <label class="field">
          <span>…THEN I will</span>
          <input type="text" id="pl-then" placeholder="get up, put the phone in the kitchen, and make wudu">
        </label>
        <div class="section-title"><span>Common triggers</span></div>
        <div class="row wrap" style="gap:6px">
          ${TRIGGERS.map((t) => raw(h`<button class="chip" data-pick="${t.label}">${t.label}</button>`))}
        </div>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Save plan</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const pick = ev.target.closest('[data-pick]');
        if (pick) {
          const input = el.querySelector('#pl-trigger');
          input.value = pick.dataset.pick;
          input.focus();
          haptic(8);
          return;
        }
        if (ev.target.closest('[data-save]')) {
          const trigger = el.querySelector('#pl-trigger').value.trim();
          const thenDo = el.querySelector('#pl-then').value.trim();
          if (!trigger || !thenDo) { toast('Fill in both halves — the plan only works as a pair.', { tone: 'warn' }); return; }
          addPlan(trigger, thenDo);
          close();
          toast('Plan saved. It will appear on the SOS screen.', { tone: 'good' });
          refresh();
        }
      });
    },
  });
}
