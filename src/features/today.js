// today.js — the home screen, and the only screen that has to be perfect.
// Everything here answers one question: what is the next thing I do?

import { h, raw, actions, haptic, toast, xpBurst, sheet, empty, bar, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { STATUS, PRAYER_LABEL, CATEGORIES, XP } from '../core/schema.js';
import { dayPlan, dayProgress, setStatus, statusOf, atRisk, streakOf, ageInDays, completionRate, undoTick,
         scheduleHabit, scheduleOf } from '../core/habits.js';
import { todayKey, prettyDayLong, minutesNow, prettyTime, parseHM, toHM, daysBetween } from '../core/dates.js';
import { prayerWindow } from '../core/prayer.js';
import { passageFor } from '../data/scripture.js';
import { todaysOffers, sideStatus, acceptSide, completeSide } from '../core/quests.js';
import { themeOf } from '../data/quests.js';
import { comboMultiplier } from '../core/game.js';
import { isOwned } from '../core/unlocks.js';
import { gateCard, gateMount } from '../ui/gate.js';
import { LEAD_MINUTES } from '../core/notify.js';
import { campaign, habitLinks, todaysMove } from '../core/links.js';
import { recoveryStats } from '../core/recovery.js';
import { habitRow, passageCard, dayRing, timeGroup, evidenceCard, attrColorFor, sideQuestCard } from '../ui/widgets.js';
import { refresh, go } from '../core/router.js';
import { classesOn, markAttendance, attendanceOverview, upcomingTasks, overdueTasks, toggleTask, ATTEND } from '../core/academics.js';
import { openSos } from './sos.js';
import { repsToday } from './reps.js';
import { hasPlan } from '../core/training.js';
import { sfx } from '../core/audio.js';
import { icon } from '../ui/icons.js';
import { streakState, milestoneDue, claimMilestone, pendingBreak, acknowledgeBreak,
         RUKHSAH_EVERY, RUKHSAH_MAX } from '../core/streak.js';
import { confetti } from '../ui/confetti.js';

/** Group the day's items under the prayer window each one falls into. */
function groupByWindow(items, times) {
  const anchors = [
    ['fajr', times.fajr], ['dhuhr', times.dhuhr], ['asr', times.asr],
    ['maghrib', times.maghrib], ['isha', times.isha],
  ];
  const groups = [
    { id: 'early', label: 'Before Fajr', at: null, items: [] },
    ...anchors.map(([id, at]) => ({ id, label: PRAYER_LABEL[id], at, items: [] })),
    { id: 'anytime', label: 'Anytime today', at: null, items: [] },
  ];
  const find = (id) => groups.find((g) => g.id === id);

  for (const item of items) {
    if (item.at >= 24 * 60) { find('anytime').items.push(item); continue; }
    let bucket = 'early';
    for (const [id, at] of anchors) if (item.at >= at) bucket = id;
    find(bucket).items.push(item);
  }
  return groups.filter((g) => g.items.length);
}

function greeting(nowMin) {
  if (nowMin < 5 * 60) return 'Still awake';
  if (nowMin < 12 * 60) return 'Good morning';
  if (nowMin < 16 * 60) return 'Good afternoon';
  if (nowMin < 20 * 60) return 'Good evening';
  return 'Winding down';
}

export const todayScreen = {
  render() {
    const state = getState();
    const key = todayKey();
    const now = minutesNow();
    const { times, items } = dayPlan(state, key);
    const progress = dayProgress(state, key);
    const win = prayerWindow(times, now);
    const groups = groupByWindow(items, times);
    const risky = items.map((i) => i.habit).filter((hab) => atRisk(hab, state, key));
    const offers = isOwned('sidequests', state) ? todaysOffers(state) : [];
    const rec = recoveryStats(state);
    const streak = streakState(state);
    const due = milestoneDue(state);
    const broke = pendingBreak(state);
    // Measured once and passed down: a fifteen-habit day would otherwise
    // walk the whole log fifteen times to draw the same two badges.
    const camp = campaign(state, key);
    const passage = passageFor(now >= 20 * 60 ? 'night' : now < 11 * 60 ? 'morning' : 'stalling', key);
    const name = state.profile.name ? `, ${state.profile.name}` : '';

    // Everything that is not a habit lives below the fold, behind one tap.
    // This screen answers one question and the rest of the app can wait.
    const running = state.focus.active;

    const later = [
      state.academics.enabled ? classesBlock(state, key) : '',
      state.academics.enabled ? deadlinesBlock(state) : '',

      // Only advertise a module that is actually switched on — a shortcut into
      // a locked screen is a dead end dressed up as a suggestion.
      running || !isOwned('focus', state) ? '' : listLink('focus', icon('target'), 'Start a focus block'),
      // Reps is free and has no gate, so the only question is whether a round
      // exists yet. Once one does it moves up into the main stack, where it can
      // show what is left of it — this row is the way in before that.
      hasPlan(state) ? '' : listLink('reps', icon('jasad'), 'Set an indoor round'),
      now >= 19 * 60 && isOwned('night', state) ? listLink('night', icon('moon'), 'Shutdown ritual') : '',
      listLink('ledger', icon('ledger'), 'The ledger'),
      h`<div class="card">${raw(passageCard(passage, { state }))}</div>`,
    ].filter(Boolean);

    return h`
      <div class="screen">
        <header class="screen__head" style="margin-bottom:12px">
          <div class="eyebrow">${prettyDayLong(key)}</div>
          <h1>${greeting(now)}${name}</h1>
        </header>

        <div class="stack">
          <div data-coach="ring">${raw(dayBanner(state, key, progress, win, streak))}</div>
          ${raw(campaignStrip(camp))}

          ${state.recovery.enabled ? raw(h`
            <div class="row" style="gap:8px">
              <button class="btn btn--danger btn--sm grow" data-act="sos">${icon('shield')} Urge — open SOS</button>
              <a class="btn btn--ghost btn--sm" href="#/shield" style="flex:none">${rec.days}d</a>
            </div>`) : raw('')}

          ${running ? raw(h`
            <button class="card row-between" data-act="focus"
                    style="padding:12px 14px;width:100%;text-align:left;border-color:var(--blue)">
              <span class="grow">
                <span style="display:block;font-weight:800;font-size:.92rem;color:var(--blue)">${icon('target')} Focus block running</span>
                <span class="muted" style="font-size:.82rem;font-weight:700">${running.task || `${running.minutes} minutes`}</span>
              </span>
              <span class="listrow__chev">\u203A</span>
            </button>`) : raw('')}

          ${broke ? raw(breakCard(broke, streak)) : raw('')}
          ${due ? raw(milestoneCard(due)) : raw('')}
          ${raw(streakCard(state))}

          ${offers.length ? raw(bulletinBoard(state, offers))
             : isOwned('sidequests', state) ? raw('')
             : raw(gateCard('sidequests'))}

          ${risky.length ? raw(riskCard(risky)) : raw('')}
          ${state.academics.enabled ? raw(attendanceBlock(state)) : raw('')}

          ${items.length === 0 ? raw(empty({
            icon: icon('sprout'),
            title: 'No habits yet',
            body: 'Two or three you can hold on your worst week.',
            actionLabel: 'Open the library',
            action: 'library',
          })) : raw(groups.map((g) => h`
            ${raw(phaseMark(g.label, g.at, g.id === win.current))}
            ${g.items.map((it) => raw(habitRow(it.habit, key, { state, camp })))}
          `).join(''))}

          ${raw(repsToday(state))}

          ${later.length ? raw(h`
            <details class="more">
              <summary><span>More today</span><i class="more__count">${later.length}</i></summary>
              <div class="stack" style="margin-top:12px">${later.map((x) => raw(x))}</div>
            </details>`) : raw('')}
        </div>
      </div>`;
  },

  mount(root) {
    // The board carries a gate card until side quests are bought, and that
    // card's button binds itself rather than going through actions().
    gateMount(root);
    actions(root, {
      claimms: (el, ds) => {
        const m = claimMilestone(Number(ds.d));
        if (!m) return;
        sfx('levelup');
        haptic([18, 50, 22, 50, 30]);
        confetti({ count: 110, origin: el.getBoundingClientRect() });
        xpBurst(m.xp, el, 'var(--gold)');
        toast(m.name, { icon: icon('flame'), tone: 'good', ms: 3200 });
        refresh();
      },
      // Acknowledging a break is the one place the app deliberately does
      // nothing else: no XP, no consolation prize, no offer to buy it back.
      seenbreak: () => { acknowledgeBreak(); haptic(10); refresh(); },
      toggle: (el, ds) => toggleHabit(ds.id, el),
      detail: (el, ds) => openHabitDetail(ds.id),
      library: () => go('habits/library'),
      quests:  () => go('quests'),
      night:   () => go('night'),
      ledger:  () => go('ledger'),
      focus:   () => go('focus'),
      reps:    () => go('reps'),
      present: (el, ds) => { markAttendance(ds.id, todayKey(), ATTEND.PRESENT); sfx('tiny'); haptic([12, 30, 16]); refresh(); },
      absent:  (el, ds) => { markAttendance(ds.id, todayKey(), ATTEND.ABSENT);  haptic(10); refresh(); },
      task:    (el, ds) => { toggleTask(ds.id); sfx('tiny'); haptic([12, 30, 16]); refresh(); },
      sos:     () => openSos(),
      posting: (el, ds) => openPosting(ds.id),
      accept:  (el, ds) => { acceptSide(ds.id); haptic(10); refresh(); },
      complete:(el, ds) => {
        const xp = completeSide(ds.id);
        if (xp) { sfx('claim'); haptic([12, 40, 18]); xpBurst(xp, el); toast('Side quest complete', { icon: icon('target'), tone: 'good' }); }
        refresh();
      },
    });
  },
};

/* ==================================================================== */
/* The streak.                                                          */
/*                                                                      */
/* Duolingo's flame is a character: it has a face, it bounces, it looks  */
/* sad at you. That works on a twelve-year-old learning Spanish and it   */
/* reads as manipulation to an adult trying to fix his prayers. This one */
/* is drawn in the same duotone geometry as every other icon in the app  */
/* — a shape, lit or unlit, no expression — and it does not move except  */
/* to fill.                                                             */
/*                                                                      */
/* Layout is the argument. The lifetime total is the largest thing on    */
/* the card because it is the number that cannot fall; the run sits      */
/* inside the flame at half the size. When a run breaks, the biggest     */
/* number on the screen does not move, and that is the whole point.      */
/* ==================================================================== */

/**
 * The flame, at a given fill level.
 *
 * `lit` is 0..1 — the fraction of the way to the next marker. The inner body
 * is clipped to that height, so a young streak is an outline with a little
 * light at the base and a mature one is solid. Nothing animates on a timer;
 * the only movement is the fill changing between renders, which means the
 * graphic never demands attention it has not earned.
 */
function flameSvg(lit, size = 92, cold = false) {
  const id = 'fl' + Math.random().toString(36).slice(2, 7);
  const fill = Math.max(0, Math.min(1, lit));
  // 4 is the tip, 23 the base, in the 24-unit viewBox.
  const y = 23 - (fill * 19);

  return `
    <svg class="flame ${cold ? 'is-cold' : ''}" viewBox="0 0 24 24" width="${size}" height="${size}"
         role="img" aria-hidden="true">
      <defs>
        <clipPath id="${id}">
          <rect x="0" y="${y.toFixed(2)}" width="24" height="24"></rect>
        </clipPath>
        <linearGradient id="${id}g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0"   stop-color="var(--flame-hot)"></stop>
          <stop offset=".55" stop-color="var(--flame-mid)"></stop>
          <stop offset="1"   stop-color="var(--flame-tip)"></stop>
        </linearGradient>
      </defs>

      <!-- the vessel: always present, so an empty streak is a shape you have
           not filled rather than an absence -->
      <path class="flame__shell"
        d="M12 2.6c.9 3.2 2.6 4.5 4.3 6.5 1.6 1.9 2.6 3.9 2.6 6.1A6.9 6.9 0 0 1 12 21.6a6.9 6.9 0 0 1-6.9-6.4c0-2.6 1.3-4.4 2.7-6.2.6-.8 1.2-1.6 1.5-2.5.5 1 1.2 1.7 2 2.4.5-1.9.6-4 .7-6.3Z"/>

      <g clip-path="url(#${id})">
        <path fill="url(#${id}g)"
          d="M12 2.6c.9 3.2 2.6 4.5 4.3 6.5 1.6 1.9 2.6 3.9 2.6 6.1A6.9 6.9 0 0 1 12 21.6a6.9 6.9 0 0 1-6.9-6.4c0-2.6 1.3-4.4 2.7-6.2.6-.8 1.2-1.6 1.5-2.5.5 1 1.2 1.7 2 2.4.5-1.9.6-4 .7-6.3Z"/>
        <!-- the inner core, so a long streak reads as hotter rather than merely
             larger -->
        <path class="flame__core"
          d="M12 12.2c.6 1.5 1.9 2.2 1.9 3.9A2.1 2.1 0 0 1 12 18.4a2.1 2.1 0 0 1-1.9-2.3c0-1.6 1.3-2.4 1.9-3.9Z"/>
      </g>
    </svg>`;
}

/**
 * The streak card.
 *
 * Reads top to bottom as: what you have (permanent), what you are on (fragile),
 * what is next, what protects you. The fragile thing is third.
 */
function streakCard(state) {
  const s = streakState(state);
  const cold = !s.keptToday && s.now === 0;

  return h`
    <div class="card streakcard ${cold ? 'is-cold' : ''}">
      <div class="streakcard__top">
        <div class="streakcard__flame">
          ${raw(flameSvg(s.pct, 92, cold))}
          <span class="streakcard__run">${s.now}</span>
        </div>

        <div class="streakcard__nums">
          <div class="streakcard__totn">${s.total}</div>
          <div class="streakcard__totl">days kept, all time</div>
          <div class="streakcard__sub">
            ${s.now === 1 ? raw('1 day running') : raw(h`${s.now} days running`)}
            ${s.best > s.now ? raw(h` <span>· best ${s.best}</span>`) : raw('')}
          </div>
        </div>
      </div>

      ${s.next ? raw(h`
        <div class="streakcard__bar"><i style="width:${(s.pct * 100).toFixed(1)}%"></i></div>
        <div class="streakcard__nextl">
          ${s.toNext} more to <strong>${s.next.name}</strong>
          <span class="pricepill">+${s.next.xp}</span>
        </div>`) : raw(h`
        <div class="streakcard__nextl">Every marker there is, reached.</div>`)}

      ${raw(markerRow(s))}
      ${raw(rukhsahRow(s.rukhsah))}
    </div>`;
}

/**
 * The vesting ladder.
 *
 * Earned markers stay lit whatever the current run is doing. This row is the
 * visible promise that a break does not undo anything, so it renders the same
 * on the day you break a hundred-day run as it did the day before.
 */
function markerRow(s) {
  return h`
    <div class="markers">
      ${s.all.map((m) => raw(h`
        <div class="marker ${m.earned ? 'is-earned' : ''} ${m.current ? 'is-current' : ''}"
             title="${m.name}${m.earned ? ' — earned' : ` — ${m.days} days`}">
          <span class="marker__d">${m.days}</span>
        </div>`))}
    </div>`;
}

/** What you are holding against a bad day. */
function rukhsahRow(r) {
  return h`
    <details class="rukhsah">
      <summary>
        <span class="rukhsah__pips">
          ${[...Array(r.max)].map((_, i) => raw(h`<i class="${i < r.held ? 'is-held' : ''}"></i>`))}
        </span>
        <span class="grow">${r.held
          ? raw(h`${r.held} rukhsah held`)
          : raw(h`No rukhsah · ${r.toNext} days to the next`)}</span>
        <i class="qa__mark" aria-hidden="true">?</i>
      </summary>
      <p class="rukhsah__body">
        A <em>rukhsah</em> is the concession already built into the law — the traveller
        shortens the prayer, the ill do not fast. You earn one for every
        ${RUKHSAH_EVERY} days you keep, you can hold ${RUKHSAH_MAX}, and one is spent
        automatically on a day you missed. It is not bought and it is not a trick:
        it is the app agreeing that some days are legitimately not available to you.
      </p>
    </details>`;
}

/**
 * A milestone reached and not yet taken.
 *
 * The only place in the streak system that celebrates, and it does it once.
 */
function milestoneCard(m) {
  return h`
    <div class="card card--gold milestone">
      <div class="milestone__ico">${raw(flameSvg(1, 40))}</div>
      <div class="grow">
        <div class="milestone__t">${m.name}</div>
        <div class="milestone__s">${m.note}</div>
      </div>
      <button class="btn btn--gold btn--sm" data-act="claimms" data-d="${m.days}">+${m.xp}</button>
    </div>`;
}

/**
 * The card shown after a run ends.
 *
 * This is the screen the whole design exists for. Duolingo shows a broken heart
 * and an offer to buy the streak back; the research says that framing — the
 * abstinence violation effect — is what converts one missed day into quitting
 * altogether. So: no apology, no consolation, no purchase. State the number,
 * state that it is kept, and put the next action in reach.
 */
function breakCard(b, s) {
  return h`
    <div class="card breakcard">
      <div class="breakcard__n">${b.was}</div>
      <div class="breakcard__t">days, and that run has ended.</div>
      <p class="breakcard__body">
        It stays in your record: ${s.total} days kept all time, best run ${s.best}.
        ${s.earned.length ? raw(h`Every marker you passed is still yours.`) : raw('')}
        Nothing has been taken off you — the counter starts again, and that is all
        that has happened.
      </p>
      <button class="btn btn--primary btn--block" data-act="seenbreak">Start the next one</button>
    </div>`;
}

/* ====================================================================== */
/* The board.                                                             */
/*                                                                        */
/* Three contracts, pinned, rolled fresh every morning and gone at         */
/* midnight. You read the postings, pick one that suits you, and take it   */
/* down — the adventurers' guild board, which is the right metaphor        */
/* because it carries the two rules that matter without stating either:    */
/* a posting is an offer rather than an order, and nobody is chasing you   */
/* about the ones you left up.                                            */
/*                                                                        */
/* It sits on Today because that is where the day is. It used to be two    */
/* taps down inside a drawer, and before that at the bottom of a different */
/* tab under fourteen quest chains.                                        */
/* ====================================================================== */

function bulletinBoard(state, offers) {
  const open = offers.filter((q) => sideStatus(q.id, state) !== 'done').length;

  return h`
    <div class="bboard">
      <div class="bboard__head">
        <span class="bboard__title">The board</span>
        <span class="bboard__sub">${open ? `${open} posted today` : 'All taken'}</span>
      </div>
      <div class="bboard__pins">
        ${offers.map((q, i) => raw(posting(q, state, i)))}
      </div>
    </div>`;
}

/** One pinned posting. Deliberately terse — the detail is behind the tap. */
function posting(q, state, i) {
  const status = sideStatus(q.id, state);
  const theme = themeOf(q);
  // A slight, stable tilt per card so the board reads as paper rather than as
  // a table. Derived from the id so it never changes between renders.
  const tilt = ((q.id.charCodeAt(0) + i * 7) % 5) - 2;

  return h`
    <button class="posting is-${raw(status)}" style="--tilt:${tilt}deg"
            data-act="posting" data-id="${q.id}">
      <span class="posting__pin" aria-hidden="true"></span>
      <span class="posting__tag" style="--pt:${raw(theme.color || 'var(--muted)')}">${theme.label}</span>
      <span class="posting__t">${q.title}</span>
      <span class="posting__foot">
        <span class="posting__xp">+${XP.questSide} XP</span>
        ${status === 'done' ? raw(h`<span class="posting__done">${icon('check', { size: 12 })} done</span>`)
          : status === 'accepted' ? raw(h`<span class="posting__taken">taken</span>`) : raw('')}
      </span>
    </button>`;
}

/** Reading a posting properly, and taking it. */
function openPosting(id) {
  const state = getState();
  const q = todaysOffers(state).find((x) => x.id === id);
  if (!q) return;
  const status = sideStatus(q.id, state);
  const theme = themeOf(q);

  sheet({
    title: 'Posting',
    body: h`
      <div class="stack">
        <div class="pdetail">
          <span class="pdetail__tag" style="--pt:${raw(theme.color || 'var(--muted)')}">${theme.label}</span>
          <div class="pdetail__t">${q.title}</div>
          <p class="pdetail__d">${q.desc}</p>
        </div>

        ${q.why ? raw(h`
          <div class="pdetail__why">
            <span class="pdetail__k">Why it is worth doing</span>
            <p>${q.why}</p>
          </div>`) : raw('')}

        <div class="pdetail__terms">
          <div class="row-between"><span>Reward</span><span class="pricepill">+${XP.questSide} XP</span></div>
          <div class="row-between"><span>Expires</span><span>Midnight tonight</span></div>
          <div class="row-between"><span>Penalty for leaving it</span><span>None</span></div>
        </div>
      </div>`,
    footer: status === 'done'
      ? h`<button class="btn btn--ghost btn--block" disabled>${icon('check', { size: 15 })} Done today</button>`
      : status === 'accepted'
        ? h`<button class="btn btn--primary btn--block" data-do="finish">Mark it done</button>`
        : h`<button class="btn btn--primary btn--block" data-do="take">Take it down</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-do="take"]')) {
          acceptSide(q.id); haptic(10); sfx('tiny');
          toast('Taken. It is yours until midnight.');
          close(); refresh();
        }
        if (ev.target.closest('[data-do="finish"]')) {
          const xp = completeSide(q.id);
          if (xp) {
            sfx('claim'); haptic([12, 40, 18]);
            toast(`${q.title} · +${xp} XP`, { icon: icon('trophy'), tone: 'good' });
          }
          close(); refresh();
        }
      });
    },
  });
}

/* ====================================================================== */
/* The day, as a run.                                                     */
/*                                                                        */
/* Today was a checklist with a small progress card above it. What makes a */
/* day feel like a run rather than a list is three things it did not have: */
/*                                                                        */
/*   A state.   The day is open, or it is clear. Those look different, and */
/*              clearing it is an event rather than a percentage reaching  */
/*              a hundred quietly.                                        */
/*   Weight.    Every objective is not worth the same. Each habit now      */
/*              carries the metal of its rank and what it actually pays,   */
/*              so a Diamond sitting in the list reads as the hard one.    */
/*   A clock.   The day has phases, and one of them is now.               */
/* ====================================================================== */

/** XP taken from today's habit rows, counted off the entries themselves. */
function haulToday(state, key) {
  const log = state.logs[key] || {};
  return Object.values(log).reduce((n, e) => n + (Number(e && e.xp) || 0), 0);
}

/**
 * The banner.
 *
 * Deliberately not a card: it is the frame the day sits in, so it spans the
 * full width and carries its own ground. When the last habit lands it turns
 * gold and stops reporting a percentage — a finished day should say it is
 * finished, not say "100%".
 */
function dayBanner(state, key, progress, win, streak) {
  const haul = haulToday(state, key);
  const combo = comboMultiplier(streak.now);
  const clear = progress.total > 0 && progress.done >= progress.total;

  return h`
    <div class="hud ${clear ? 'is-clear' : ''}">
      <div class="hud__glow" aria-hidden="true"></div>

      <div class="hud__main">
        ${raw(hudRing(progress, clear))}
        <div class="hud__body">
          <div class="hud__k">${clear ? 'The day is clear' : 'The day'}</div>
          <div class="hud__t">${progress.total === 0
            ? 'Nothing due'
            : clear ? `All ${progress.total} held`
            : `${progress.done} of ${progress.total} held`}</div>
          <div class="hud__stats">
            <span class="hud__stat">${icon('bolt', { size: 13 })}${haul} XP</span>
            ${combo > 1 ? raw(h`<span class="hud__stat is-combo">${icon('flame', { size: 13 })}×${combo.toFixed(2).replace(/0$/, '')}</span>`) : raw('')}
            ${streak.now ? raw(h`<span class="hud__stat">${streak.now}d run</span>`) : raw('')}
          </div>
        </div>
      </div>

      <div class="hud__foot">
        <span class="hud__phase">${PRAYER_LABEL[win.next] || win.next}</span>
        <span class="hud__in">in ${fmtCountdown(win.minutesToNext)}</span>
      </div>
    </div>`;
}

/** The ring, drawn a little heavier than the old one so it carries the block. */
function hudRing(progress, clear) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, progress.pct)));
  return `
    <div class="hud__ring">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="${r}" class="hud__track"/>
        <circle cx="36" cy="36" r="${r}" class="hud__fill ${clear ? 'is-clear' : ''}"
                stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <span class="hud__pct">${progress.total === 0 ? '—' : `${Math.round(progress.pct * 100)}`}</span>
    </div>`;
}

/**
 * A phase marker.
 *
 * The prayer groups were labels. They are markers now, with a rule running out
 * from them and the one you are currently inside picked out, so the list reads
 * as a day being walked through rather than as five headings.
 */
function phaseMark(label, minutes, isNow) {
  return h`
    <div class="phase ${isNow ? 'is-now' : ''}">
      <span class="phase__dot" aria-hidden="true"></span>
      <span class="phase__l">${label}</span>
      ${minutes != null ? raw(h`<span class="phase__t">${prettyTime(minutes)}</span>`) : raw('')}
      <span class="phase__rule" aria-hidden="true"></span>
      ${isNow ? raw(h`<span class="phase__now">now</span>`) : raw('')}
    </div>`;
}

/**
 * What you are running, on the screen where you run it.
 *
 * The Ascent is where you take a trial and name a pursuit; this is where those
 * are actually done. Without it the two screens describe the same numbers to
 * each other and neither tells you what to tap.
 */
function campaignStrip(camp) {
  const rows = [];

  if (camp.trial) {
    const { spec, progress, daysLeft: left } = camp.trial;
    const move = todaysMove(spec.metric, spec.args || {});
    rows.push(h`
      <a class="camp ${progress.met ? 'is-won' : left <= 2 ? 'is-urgent' : ''}" href="#/quests">
        <span class="camp__ico">${icon('flame', { size: 17 })}</span>
        <span class="grow">
          <span class="camp__k">Trial${progress.met ? ' · complete' : ` · ${left} day${left === 1 ? '' : 's'} left`}</span>
          <span class="camp__t">${spec.title}</span>
          ${move && !progress.met ? raw(h`<span class="camp__do">${move}</span>`) : raw('')}
        </span>
        <span class="camp__n">${progress.raw}<i>/${progress.target}</i></span>
      </a>`);
  }

  if (camp.pursuit) {
    const { quest, progress } = camp.pursuit;
    const move = todaysMove(quest.goal.type, quest.goal);
    rows.push(h`
      <a class="camp" href="#/quests">
        <span class="camp__ico">${icon('target', { size: 17 })}</span>
        <span class="grow">
          <span class="camp__k">Pushing on</span>
          <span class="camp__t">${quest.chainTitle}</span>
          ${move ? raw(h`<span class="camp__do">${move}</span>`) : raw('')}
        </span>
        <span class="camp__n">${progress.value}<i>/${progress.target}</i></span>
      </a>`);
  }

  if (!rows.length) return '';
  return h`<div class="camps">${rows.map((r) => raw(r))}</div>`;
}

/**
 * Putting a clock on a habit.
 *
 * Two buttons rather than a mode switch plus a save: "just today" and "every
 * day" are the whole decision, and making them the actions means you cannot
 * set a time and then wonder which one you got. The one-off is stored apart
 * from the standing time, so using it tonight never edits your routine.
 */
function scheduleBlock(habit, key) {
  const sched = scheduleOf(habit, key);
  const value = sched.at != null ? toHM(sched.at) : '';

  return h`
    <div class="card sched">
      <div class="row-between">
        <span class="card__title" style="margin:0">${icon('clock')} Time</span>
        ${sched.at != null ? raw(h`
          <span class="sched__now">
            ${prettyTime(sched.at)} · ${sched.mode === 'today' ? 'today only' : 'every day'}
          </span>`) : raw('')}
      </div>

      <input type="time" id="sched-time" class="sched__in" value="${value}">

      <div class="row" style="gap:7px;margin-top:9px">
        <button class="btn btn--ghost btn--sm grow" data-sched="today">Just today</button>
        <button class="btn btn--primary btn--sm grow" data-sched="always">Every day</button>
      </div>
      ${sched.at != null ? raw(h`
        <button class="btn btn--ghost btn--sm btn--block" data-sched="clear" style="margin-top:7px">Clear it</button>`) : raw('')}

      <p class="sched__note">
        An alarm ${LEAD_MINUTES} minutes before, with buttons to mark it done or push it
        ten minutes. It needs notifications allowed, and it can only reach you while the
        app is open or recently used — a web app cannot wake your phone the way a real
        alarm clock does.
      </p>
    </div>`;
}

/** A row in "More today" — a label and a chevron, nothing explaining itself.
 *  The parameter is `ico` and not `icon`: the latter would shadow the import. */
function listLink(act, ico, label) {
  return h`
    <button class="listrow" data-act="${act}" style="width:100%;text-align:left">
      <span class="listrow__icon">${ico}</span>
      <span class="grow" style="font-weight:640">${label}</span>
      <span class="listrow__chev">›</span>
    </button>`;
}

function fmtCountdown(mins) {
  const m = Math.max(0, Math.round(mins));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function riskCard(risky) {
  const names = risky.slice(0, 3).map((r) => r.title).join(', ');
  return h`
    <div class="card card--warn" style="padding:12px 14px">
      ${raw(qaRow(
        raw(h`<span style="font-weight:800">${icon('alert')} Missed yesterday</span><br><span style="font-size:.86rem;font-weight:600">${names}${risky.length > 3 ? ` +${risky.length - 3}` : ''}</span>`),
        'One miss is nothing. Two in a row is how habits die — so do the two-minute version today and the chain holds.'))}
    </div>`;
}

/* -------------------------------------------------- university blocks */

/** Today's classes, with one-tap attendance. Full control lives on the Uni tab. */
function classesBlock(state, key) {
  const classes = classesOn(key, state);
  if (!classes.length) return '';
  return h`
    <div class="timegroup"><span class="timegroup__label">Classes</span></div>
    <div class="stack-sm">
      ${classes.map((c) => raw(h`
        <div class="card" style="padding:12px 14px;${raw(c.status === ATTEND.PRESENT ? 'border-color:var(--green)' : c.status === ATTEND.ABSENT ? 'border-color:var(--red)' : '')}">
          <div class="row-between">
            <div class="grow">
              <div style="font-weight:800">${c.course.code || c.course.title}</div>
              <div class="muted" style="font-size:.78rem;margin-top:2px;font-weight:700">
                ${prettyTime(parseHM(c.slot.start) ?? 0)}${c.slot.room ? ' · ' + c.slot.room : ''}
              </div>
            </div>
            ${c.status
              ? raw(h`<span class="pill pill--${raw(c.status === ATTEND.PRESENT ? 'accent' : c.status === ATTEND.ABSENT ? 'danger' : 'blue')}">${c.status}</span>`)
              : raw(h`
                <button class="btn btn--primary btn--sm" data-act="present" data-id="${c.course.id}">Present</button>
                <button class="btn btn--ghost btn--sm" data-act="absent" data-id="${c.course.id}">Absent</button>`)}
          </div>
        </div>`))}
    </div>`;
}

/** The one warning worth interrupting the day for. */
function attendanceBlock(state) {
  const rows = attendanceOverview(state).filter((r) => r.atRisk || (r.canMiss !== null && r.canMiss <= 1));
  if (!rows.length) return '';
  const r = rows[0];
  return h`
    <a class="card card--danger row-between" href="#/uni" style="padding:12px 14px;color:inherit">
      <span class="grow">
        <span style="display:block;font-weight:800;font-size:.92rem">${icon('alert')} ${r.course.code || r.course.title} \u2014 ${Math.round((r.pct ?? 0) * 100)}%</span>
        ${r.canMiss !== null ? raw(h`<span style="font-size:.86rem">${r.canMiss} more class${r.canMiss === 1 ? '' : 'es'} you may miss${rows.length > 1 ? ` \u00b7 +${rows.length - 1} close` : ''}</span>`) : raw('')}
      </span>
      <span class="listrow__chev">\u203A</span>
    </a>`;
}

/** Deadlines inside the next week, so they cannot ambush you. */
function deadlinesBlock(state) {
  const soon = upcomingTasks(state, 7);
  const late = overdueTasks(state);
  const rows = [...late, ...soon];
  if (!rows.length) return '';
  return h`
    <div class="section-title"><span>Due soon</span>
      <a href="#/uni" style="font-size:.72rem;text-transform:none;letter-spacing:0">All</a></div>
    <div class="stack-sm">
      ${rows.slice(0, 4).map((t) => {
        const days = t.due ? daysBetween(todayKey(), t.due) : null;
        return raw(h`
          <div class="task" style="${raw(days !== null && days <= 1 ? 'border-color:var(--red)' : '')}">
            <button class="habitrow__check" data-act="task" data-id="${t.id}" aria-label="Done">${icon('check')}</button>
            <div class="grow">
              <div class="task__title">${t.title}</div>
              <div class="muted" style="font-size:.76rem;margin-top:2px;font-weight:700">
                ${days === null ? 'no date' : days < 0 ? `${-days}d late` : days === 0 ? 'due today' : `in ${days} days`}
              </div>
            </div>
          </div>`);
      })}
    </div>`;
}

/* ----------------------------------------------------------- interaction */

function toggleHabit(id, el) {
  const state = getState();
  const key = todayKey();
  const habit = state.habits.find((x) => x.id === id);
  if (!habit) return;
  const before = statusOf(state, key, id);
  const xpBefore = getState().game.xp;

  setStatus(id, key, STATUS.DONE);

  const after = statusOf(getState(), key, id);
  if (after === STATUS.DONE) {
    const streak = streakOf(habit, getState(), key);
    const day = dayProgress(getState(), key);
    // The day being finished outranks the individual tick, and a seventh day
    // outranks an ordinary one.
    sfx(day.total && day.done >= day.total ? 'dayDone' : streak > 1 && streak % 7 === 0 ? 'streak' : 'done');
    haptic([14, 30, 20]);
    const gained = getState().game.xp - xpBefore;
    xpBurst(gained, el, attrColorFor(habit.category));
    // Every tick offers a way straight back out. Rows sit close together and a
    // thumb is wider than one of them, so the question is not whether the wrong
    // habit gets ticked but how much work it is to put right.
    const undo = {
      label: 'Undo',
      onClick: () => {
        const res = undoTick(id, key);
        if (!res) return;
        sfx('undo');
        haptic(10);
        toast(res.refunded ? `${habit.title} — undone, −${res.refunded} XP` : `${habit.title} — undone`);
        refresh();
      },
    };
    // Say what the tick moved, not just that it happened. This is the moment
    // the two screens are actually joined: a trial you accepted on the Ascent
    // ticking over on the row that fed it.
    const moved = habitLinks(habit, campaign(getState(), key))[0];
    if (streak > 1 && streak % 7 === 0) {
      toast(`${streak}-day streak on ${habit.title}`, { icon: icon('flame'), tone: 'good', ms: 5000, action: undo });
    } else if (moved) {
      toast(`${habit.title} · ${moved.label} ${moved.detail.split(' · ')[0]}`,
        { icon: icon(moved.kind === 'trial' ? 'flame' : 'target'), tone: 'good', ms: 5200, action: undo });
    } else {
      toast(`${habit.title}`, { icon: icon('check'), tone: 'good', ms: 5000, action: undo });
    }
  } else if (before) {
    sfx('undo');
    haptic(8);
  }
  refresh();
}

/**
 * The habit detail sheet: cue, the two-minute version, streak, the evidence,
 * and the three ways to close it out. This is where a habit stops being a
 * checkbox and becomes a plan.
 */
export function openHabitDetail(id) {
  const state = getState();
  const key = todayKey();
  const habit = state.habits.find((x) => x.id === id);
  if (!habit) return;

  const status = statusOf(state, key, id);
  const streak = streakOf(habit, state, key);
  const age = ageInDays(habit, state);
  const rate = completionRate(habit, state, 30);
  const cat = CATEGORIES[habit.category];

  const body = h`
    <div class="stack">
      ${habit.cue ? raw(h`
        <div class="card card--accent">
          <div class="muted" style="font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;margin-bottom:5px">Your plan</div>
          <div style="font-weight:600;line-height:1.5">${habit.cue}</div>
        </div>`) : raw('')}

      <div class="statgrid">
        <div class="stat"><div class="stat__n">${streak}</div><div class="stat__l">streak</div></div>
        <div class="stat"><div class="stat__n">${Math.round(rate * 100)}%</div><div class="stat__l">last 30d</div></div>
        <div class="stat"><div class="stat__n">${age}</div><div class="stat__l">days in</div></div>
      </div>

      ${age > 0 ? raw(h`
        <div>
          <div class="row-between muted" style="font-size:.74rem;margin-bottom:5px">
            <span>Toward automaticity</span><span class="mono">${Math.min(age, 66)} / 66 days</span>
          </div>
          ${bar(Math.min(1, age / 66), { color: 'var(--gold)' })}
          <div class="muted" style="font-size:.72rem;margin-top:5px">Median time for a habit to become automatic is 66 days, not 21 (Lally et al., 2010).</div>
        </div>`) : raw('')}

      ${habit.tiny ? raw(h`
        <div class="card">
          <div class="card__title">${icon('timer')} The two-minute version</div>
          <p class="prose" style="margin:0">${habit.tiny}</p>
          <p class="muted" style="font-size:.78rem;margin:8px 0 0">On a bad day, do this. It still counts, and it still pays XP.</p>
        </div>`) : raw('')}

      ${habit.why ? raw(h`<div class="card"><div class="card__title">${icon('target')} Why you chose this</div><p class="prose" style="margin:0">${habit.why}</p></div>`) : raw('')}

      ${habit.evidence ? raw(evidenceCard(habit.evidence, { full: true })) : raw('')}

      ${raw(scheduleBlock(habit, key))}

      <div class="row wrap" style="gap:6px">
        ${cat ? raw(h`<span class="pill">${cat.label}</span>`) : raw('')}
        ${habit.anchorPrayer ? raw(h`<span class="pill">after ${PRAYER_LABEL[habit.anchorPrayer]}</span>`) : raw('')}
        ${habit.proof ? raw(h`<span class="pill pill--gold">${habit.proof}</span>`) : raw('')}
      </div>
    </div>`;

  sheet({
    title: habit.title,
    body,
    footer: h`
      <button class="btn ${status === STATUS.SKIP ? 'btn--ghost' : 'btn--ghost'}" data-do="skip">Rest day</button>
      <button class="btn btn--ghost" data-do="tiny">2-min</button>
      <button class="btn btn--primary" data-do="done">Done</button>`,
    onMount: (el, close) => {
      // Scheduling lives inside this sheet, so it binds here rather than in
      // the screen's action map.
      const timeInput = el.querySelector('#sched-time');
      el.addEventListener('click', (ev) => {
        const set = ev.target.closest('[data-sched]');
        if (set) {
          const mode = set.dataset.sched;
          if (mode === 'clear') {
            scheduleHabit(id, null, 'today', key);
            scheduleHabit(id, null, 'always', key);
            haptic(10);
            toast('Time cleared');
          } else {
            const mins = parseHM(timeInput.value);
            if (mins == null) { toast('Pick a time first', { tone: 'warn' }); return; }
            scheduleHabit(id, mins, mode, key);
            haptic([12, 30, 16]);
            toast(mode === 'today'
              ? `Today at ${prettyTime(mins)} · alarm ${LEAD_MINUTES} minutes before`
              : `Every day at ${prettyTime(mins)} · alarm ${LEAD_MINUTES} minutes before`,
              { icon: icon('clock'), tone: 'good', ms: 3400 });
          }
          close();
          refresh();
          return;
        }

        const btn = ev.target.closest('[data-do]');
        if (!btn) return;
        const map = { done: [STATUS.DONE, 'full'], tiny: [STATUS.PARTIAL, 'tiny'], skip: [STATUS.SKIP, 'full'] };
        const [st, tier] = map[btn.dataset.do];
        const xpBefore = getState().game.xp;
        setStatus(id, key, st, { tier });
        const gained = getState().game.xp - xpBefore;
        sfx(st === STATUS.SKIP ? 'rest' : st === STATUS.PARTIAL ? 'tiny' : 'done');
        haptic([14, 30, 20]);
        if (gained) xpBurst(gained, btn, attrColorFor(habit.category));
        if (st === STATUS.SKIP) toast('Marked as a planned rest day — streak preserved', { icon: icon('sleep') });
        close();
        refresh();
      });
    },
  });
}
