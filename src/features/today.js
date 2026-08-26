// today.js — the home screen, and the only screen that has to be perfect.
// Everything here answers one question: what is the next thing I do?

import { h, raw, actions, haptic, toast, xpBurst, sheet, empty, bar, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { STATUS, PRAYER_LABEL, CATEGORIES } from '../core/schema.js';
import { dayPlan, dayProgress, setStatus, statusOf, atRisk, streakOf, ageInDays, completionRate } from '../core/habits.js';
import { todayKey, prettyDayLong, minutesNow, prettyTime, parseHM, daysBetween } from '../core/dates.js';
import { prayerWindow } from '../core/prayer.js';
import { passageFor } from '../data/scripture.js';
import { todaysOffers, sideStatus, acceptSide, completeSide } from '../core/quests.js';
import { isOwned } from '../core/unlocks.js';
import { recoveryStats } from '../core/recovery.js';
import { habitRow, passageCard, dayRing, timeGroup, evidenceCard, attrColorFor, sideQuestCard } from '../ui/widgets.js';
import { refresh, go } from '../core/router.js';
import { classesOn, markAttendance, attendanceOverview, upcomingTasks, overdueTasks, toggleTask, ATTEND } from '../core/academics.js';
import { openSos } from './sos.js';
import { sfx } from '../core/audio.js';
import { icon } from '../ui/icons.js';

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
    const passage = passageFor(now >= 20 * 60 ? 'night' : now < 11 * 60 ? 'morning' : 'stalling', key);
    const name = state.profile.name ? `, ${state.profile.name}` : '';

    // Everything that is not a habit lives below the fold, behind one tap.
    // This screen answers one question and the rest of the app can wait.
    const running = state.focus.active;

    const later = [
      state.academics.enabled ? classesBlock(state, key) : '',
      state.academics.enabled ? deadlinesBlock(state) : '',
      offers.length ? h`
        <div class="section-title"><span>Side quests</span>
          <span class="muted" style="text-transform:none;letter-spacing:0">optional</span></div>
        <div class="stack-sm">${offers.map((q) => raw(sideQuestCard(q, state)))}</div>` : '',
      // Only advertise a module that is actually switched on — a shortcut into
      // a locked screen is a dead end dressed up as a suggestion.
      running || !isOwned('focus', state) ? '' : listLink('focus', icon('target'), 'Start a focus block'),
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
          <div class="card" data-coach="ring" style="padding:12px 14px">
            <div class="row" style="gap:14px">
              ${raw(dayRing(progress))}
              <div style="text-align:right;flex:none">
                <div class="muted" style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;font-weight:800">Next</div>
                <div style="font-weight:700;font-size:.92rem">${PRAYER_LABEL[win.next] || win.next}</div>
                <div class="mono muted" style="font-size:.78rem;font-weight:700">${fmtCountdown(win.minutesToNext)}</div>
              </div>
            </div>
          </div>

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

          ${risky.length ? raw(riskCard(risky)) : raw('')}
          ${state.academics.enabled ? raw(attendanceBlock(state)) : raw('')}

          ${items.length === 0 ? raw(empty({
            icon: icon('sprout'),
            title: 'No habits yet',
            body: 'Two or three you can hold on your worst week.',
            actionLabel: 'Open the library',
            action: 'library',
          })) : raw(groups.map((g) => h`
            ${raw(timeGroup(g.label, g.at))}
            ${g.items.map((it) => raw(habitRow(it.habit, key, { state })))}
          `).join(''))}

          ${later.length ? raw(h`
            <details class="more">
              <summary><span>More today</span><i class="more__count">${later.length}</i></summary>
              <div class="stack" style="margin-top:12px">${later.map((x) => raw(x))}</div>
            </details>`) : raw('')}
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      toggle: (el, ds) => toggleHabit(ds.id, el),
      detail: (el, ds) => openHabitDetail(ds.id),
      library: () => go('habits/library'),
      night:   () => go('night'),
      ledger:  () => go('ledger'),
      focus:   () => go('focus'),
      present: (el, ds) => { markAttendance(ds.id, todayKey(), ATTEND.PRESENT); sfx('tiny'); haptic([12, 30, 16]); refresh(); },
      absent:  (el, ds) => { markAttendance(ds.id, todayKey(), ATTEND.ABSENT);  haptic(10); refresh(); },
      task:    (el, ds) => { toggleTask(ds.id); sfx('tiny'); haptic([12, 30, 16]); refresh(); },
      sos:     () => openSos(),
      accept:  (el, ds) => { acceptSide(ds.id); haptic(10); refresh(); },
      complete:(el, ds) => {
        const xp = completeSide(ds.id);
        if (xp) { sfx('claim'); haptic([12, 40, 18]); xpBurst(xp, el); toast('Side quest complete', { icon: icon('target'), tone: 'good' }); }
        refresh();
      },
    });
  },
};

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
    if (streak > 1 && streak % 7 === 0) toast(`${streak}-day streak on ${habit.title}`, { icon: icon('flame'), tone: 'good' });
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
      el.addEventListener('click', (ev) => {
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
