// upcoming.js — everything with a date attached, in one list.
//
// The app knows about four kinds of thing that are about to happen and, until
// now, kept each of them on its own screen: a quest tier you can already claim,
// a habit that is one miss from breaking, a class or deadline, and the dates on
// the Me screen. Finding out any of it meant remembering to go and look.
//
// This gathers them, sorts by how soon and how much it matters, and hands the
// result to the bell in the top bar. It reads state and derives; it never
// writes, and it never invents an event that some screen would not also show.

import { getState } from './store.js';
import { todayKey, addDays, daysBetween, minutesNow, parseHM } from './dates.js';
import { dayPlan, atRisk, isDue, statusOf } from './habits.js';
import { STATUS } from './schema.js';
import { mainBoard } from './quests.js';
import { classesOn, upcomingTasks, overdueTasks, attendanceOverview } from './academics.js';
import { spanWeeks, countdown, isDayKey } from './horizons.js';
import { comebackDue, daysMissed } from './comeback.js';
import { allUnlockStatuses } from './unlocks.js';

/* Higher sorts first when two things are equally soon. A claimable reward and a
   chain about to break are worth interrupting for; a countdown is not. */
const URGENCY = { act: 3, warn: 2, soon: 1, info: 0 };

function ev(kind, { tone = 'info', icon, title, detail = '', href, at = 0, key }) {
  return { kind, tone, icon, title, detail, href, at, key, rank: URGENCY[tone] ?? 0 };
}

/* ------------------------------------------------------------------ habits */

function habitEvents(state, key) {
  const out = [];
  const { items } = dayPlan(state, key);

  // A habit missed yesterday and not yet done today: one more miss and the
  // chain is gone. This is the single most actionable thing the app knows.
  for (const it of items) {
    if (atRisk(it.habit, state, key)) {
      out.push(ev('habit', {
        tone: 'warn', icon: 'flame', href: '#/today',
        key: `risk-${it.habit.id}`,
        title: it.habit.title,
        detail: 'Missed yesterday — do the two-minute version',
      }));
    }
  }

  // Still outstanding late in the day.
  const now = minutesNow();
  if (now >= 18 * 60) {
    const left = items.filter((it) => {
      const st = statusOf(state, key, it.habit.id);
      return st !== STATUS.DONE && st !== STATUS.PARTIAL && st !== STATUS.SKIP;
    });
    if (left.length) {
      out.push(ev('habit', {
        tone: 'soon', icon: 'clock', href: '#/today', key: 'left-today',
        title: `${left.length} still open today`,
        detail: left.slice(0, 2).map((it) => it.habit.title).join(', ') + (left.length > 2 ? '…' : ''),
      }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ quests */

function questEvents(state) {
  const out = [];
  for (const row of mainBoard(state)) {
    if (row.done || row.locked) continue;
    if (row.progress.met) {
      out.push(ev('quest', {
        tone: 'act', icon: 'trophy', href: '#/quests', key: `claim-${row.quest.id}`,
        title: `${row.quest.title} is ready`,
        detail: `Claim +${row.quest.xp} XP`,
      }));
    } else if (row.progress.target - row.progress.value === 1) {
      // One repetition away. Worth knowing today, not next week.
      out.push(ev('quest', {
        tone: 'soon', icon: 'target', href: '#/quests', key: `near-${row.quest.id}`,
        title: `One left: ${row.quest.title}`,
        detail: `${row.progress.value} / ${row.progress.target}`,
      }));
    }
  }
  return out;
}

/* --------------------------------------------------------------------- uni */

function uniEvents(state, key) {
  if (!state.academics.enabled) return [];
  const out = [];

  for (const r of attendanceOverview(state)) {
    if (r.canMiss !== null && r.canMiss <= 1) {
      out.push(ev('uni', {
        tone: 'warn', icon: 'alert', href: '#/uni', key: `att-${r.course.id}`,
        title: `${r.course.code || r.course.title} attendance`,
        detail: r.canMiss <= 0 ? 'No more misses left' : 'One more class you may miss',
      }));
    }
  }

  for (const t of overdueTasks(state)) {
    out.push(ev('uni', {
      tone: 'act', icon: 'alert', href: '#/uni', key: `late-${t.id}`,
      title: t.title, detail: `${Math.abs(daysBetween(todayKey(), t.due))} days late`,
    }));
  }

  for (const t of upcomingTasks(state, 7)) {
    const d = daysBetween(key, t.due);
    out.push(ev('uni', {
      tone: d <= 1 ? 'warn' : 'soon', icon: 'ledger', href: '#/uni', key: `task-${t.id}`,
      at: d,
      title: t.title,
      detail: d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d} days`,
    }));
  }

  for (const c of classesOn(key, state)) {
    if (c.status) continue;           // already marked
    const start = parseHM(c.slot.start) ?? 0;
    if (start < minutesNow() - 30) continue;
    out.push(ev('uni', {
      tone: 'soon', icon: 'cap', href: '#/today', key: `class-${c.course.id}-${c.slot.start}`,
      title: c.course.code || c.course.title,
      detail: `${c.slot.start}${c.slot.room ? ' · ' + c.slot.room : ''} — mark attendance`,
    }));
  }
  return out;
}

/* ------------------------------------------------------- dates and the self */

function dateEvents(state, key) {
  const out = [];
  const p = state.profile;

  // Semester end, graduation and the marriage date, but only once they are
  // close enough to be news. A countdown two years out is not an event.
  const sem = spanWeeks(state.academics.semester?.startDate, state.academics.semester?.endDate, key);
  if (state.academics.enabled && sem && sem.phase === 'during' && sem.remainingDays <= 21) {
    out.push(ev('date', {
      tone: 'soon', icon: 'calendar', href: '#/uni', key: 'sem-end', at: sem.remainingDays,
      title: `${state.academics.semester.name || 'This semester'} ends soon`,
      detail: `${sem.remainingDays} days left`,
    }));
  }

  for (const [field, title, icon, href] of [
    ['uniEnd', 'Graduation', 'cap', '#/me'],
    ['marriageDate', 'The date you are planning around', 'calendar', '#/me'],
  ]) {
    if (!isDayKey(p[field])) continue;
    const cd = countdown(p[field], key);
    if (cd.past || cd.absDays > 30) continue;
    out.push(ev('date', {
      tone: 'info', icon, href, key: field, at: cd.absDays,
      title, detail: cd.absDays === 0 ? 'Today' : `In ${cd.absDays} days`,
    }));
  }

  if (comebackDue(state, key)) {
    out.push(ev('self', {
      tone: 'act', icon: 'sprout', href: '#/return', key: 'comeback',
      title: 'Welcome back',
      detail: `${daysMissed(state, key)} days missed — start again today`,
    }));
  }

  const week = state.reviews.some((r) => r.weekOfKey === weekStart(key));
  if (!week && [0, 6].includes(new Date(key.replace(/-/g, '/')).getDay())) {
    out.push(ev('self', {
      tone: 'soon', icon: 'map', href: '#/me/review', key: 'review',
      title: 'Weekly review', detail: 'Not done this week · +60 XP',
    }));
  }
  return out;
}

function weekStart(key) {
  const dow = new Date(key.replace(/-/g, '/')).getDay();
  return addDays(key, -((dow + 6) % 7));
}

/* ----------------------------------------------------------------- unlocks */

/**
 * Something on the shelf you can now afford.
 *
 * Only ever fires for a module that is buyable *right now* — never for one that
 * is level-locked or out of reach, because a notification you cannot act on is
 * just a nag. Tone is `soon` rather than `act`: it is an option that opened, not
 * a thing that needs doing, and it should never outrank a chain about to break.
 */
function unlockEvents(state) {
  return allUnlockStatuses(state)
    .filter((u) => u.phase === 'buyable')
    .map((u) => ev('unlock', {
      tone: 'soon', icon: u.def.icon, href: '#/vault', key: `unlock-${u.id}`,
      title: `${u.def.label} is within budget`,
      detail: `${u.cost} XP of your ${u.balance.toLocaleString()} free`,
    }));
}

/* -------------------------------------------------------------------- all */

/**
 * Everything worth a badge, most urgent first.
 * `dismissed` keys are filtered out; they come back tomorrow if still true,
 * because the point is a nudge and not a permanent to-do list.
 */
export function upcoming(state = getState(), key = todayKey()) {
  const dismissed = new Set(state.notifications?.day === key ? state.notifications.dismissed : []);
  const all = [
    ...habitEvents(state, key),
    ...questEvents(state),
    ...uniEvents(state, key),
    ...dateEvents(state, key),
    ...unlockEvents(state),
  ].filter((e) => !dismissed.has(e.key));

  all.sort((a, b) => (b.rank - a.rank) || (a.at - b.at) || a.title.localeCompare(b.title));
  return all;
}

/** What the badge shows: things that want doing, not the whole list. */
export function badgeCount(state = getState(), key = todayKey()) {
  return upcoming(state, key).filter((e) => e.rank >= URGENCY.warn).length;
}

export { URGENCY };
