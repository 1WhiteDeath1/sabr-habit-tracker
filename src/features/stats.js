// stats.js (screens) — Records and the Clock, both reached from Me.
//
// Routes: #/me/records · #/me/clock
//
// Deliberately not on Today and deliberately not a tab. Analytics are something
// you visit on purpose; putting them next to the checkbox would make the app
// about looking at yourself rather than about doing the thing.

import { h, raw, actions, qaRow } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { records, comebacks, clock } from '../core/stats.js';
import { prettyDay, prettyTime, keyToDate } from '../core/dates.js';
import { CATEGORIES } from '../core/schema.js';
import { icon } from '../ui/icons.js';

/* ------------------------------------------------------------------ peek */

/**
 * The analytics, on the Me screen, without a tap.
 *
 * These pages were at the bottom of a 2,176px screen — 2.6 phone screens of
 * scrolling — which is the same as not shipping them. The numbers that make
 * someone want to open the full page have to be visible before they decide to,
 * so the three that never go down are printed here and the rest is one tap away.
 */
export function statsPeek(state = getState()) {
  const r = records(state);
  if (!r.total) return '';

  const cb = comebacks(state);
  const c = clock(state, { days: 30 });

  return h`
    <div class="section-title"><span>Your record</span>
      <a href="#/me/records" style="font-size:.72rem;text-transform:none;letter-spacing:0">All of it \u203A</a></div>

    <div class="peekgrid">
      <a class="peek" href="#/me/records">
        <span class="peek__n">${r.total.toLocaleString()}</span>
        <span class="peek__l">completed</span>
      </a>
      <a class="peek" href="#/me/records">
        <span class="peek__n" style="color:var(--orange)">${r.bestStreak ? r.bestStreak.best : 0}</span>
        <span class="peek__l">longest chain</span>
      </a>
      <a class="peek" href="#/me/records">
        <span class="peek__n" style="color:var(--purple-edge)">${cb ? cb.times : 0}</span>
        <span class="peek__l">comebacks</span>
      </a>
    </div>

    ${c.peakHour != null ? raw(h`
      <a class="listrow" href="#/me/clock" style="text-decoration:none;color:inherit">
        <span class="listrow__icon">${icon('clock')}</span>
        <span class="grow">
          <span style="display:block;font-weight:620">Most days you finish around ${prettyTime(c.peakHour * 60)}</span>
          <span class="muted" style="font-size:.78rem">${c.habits.length
            ? `${c.habits.filter((x) => x.verdict.id === 'anchored').length} of ${c.habits.length} habits have a fixed time`
            : 'See when each habit actually happens'}</span>
        </span>
        <span class="listrow__chev">\u203A</span>
      </a>`) : raw(h`
      <a class="listrow" href="#/me/clock" style="text-decoration:none;color:inherit">
        <span class="listrow__icon">${icon('clock')}</span>
        <span class="grow"><span style="display:block;font-weight:620">The clock</span>
          <span class="muted" style="font-size:.78rem">What time you actually do things</span></span>
        <span class="listrow__chev">\u203A</span>
      </a>`)}`;
}

/* --------------------------------------------------------------- records */

/** One record. The number is the point, so it gets the size. */
function record(value, label, note) {
  return h`
    <div class="rec">
      <div class="rec__n">${value}</div>
      <div class="rec__l">${label}</div>
      ${note ? raw(h`<div class="rec__note">${note}</div>`) : raw('')}
    </div>`;
}

function monthName(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function renderRecords() {
  const state = getState();
  const r = records(state);
  const cb = comebacks(state);

  if (!r.total) {
    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
          <h1 style="margin-top:6px">Records</h1>
        </header>
        <div class="card">
          <p class="prose" style="margin:0">Nothing to show yet. Finish one habit and this page starts filling up.</p>
        </div>
      </div>`;
  }

  return h`
    <div class="screen">
      <header class="screen__head" style="margin-bottom:12px">
        <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
        <h1 style="margin-top:6px">Records</h1>
      </header>

      <div class="stack">
        <div class="card rec__hero">
          <div class="rec__hero-n">${r.total.toLocaleString()}</div>
          <div class="rec__hero-l">habits completed, all time</div>
        </div>

        <div class="card" style="padding:10px 14px">
          ${raw(qaRow('Nothing on this page can go down',
            'A streak exists to be lost, which makes it the worst thing to look at on the day you most need to open the app. Every number here is a ceiling instead — a bad week cannot take any of them away from you. That is what makes this the page it is safe to open after one.'))}
        </div>

        <div class="section-title"><span>Bests</span></div>
        <div class="recgrid">
          ${raw(record(r.bestDay.n, 'in one day', r.bestDay.key ? prettyDay(r.bestDay.key) : ''))}
          ${raw(record(r.bestWeek.n, 'in one week', r.bestWeek.key ? `week of ${prettyDay(r.bestWeek.key)}` : ''))}
          ${raw(record(r.bestMonth.n, 'in one month', monthName(r.bestMonth.key)))}
          ${raw(record(r.daysLogged, 'days logged', 'days you showed up at all'))}
        </div>

        <div class="section-title"><span>Perfect days</span></div>
        <div class="recgrid">
          ${raw(record(r.perfectDays, 'perfect days', 'everything due, done'))}
          ${raw(record(r.bestPerfectRun, 'in a row', 'the longest clean sweep'))}
        </div>

        ${r.bestStreak ? raw(h`
          <div class="section-title"><span>Longest chain</span></div>
          <div class="card rec__wide">
            <div class="rec__n" style="color:var(--orange)">${r.bestStreak.best}</div>
            <div class="rec__l">days of ${r.bestStreak.habit.title}</div>
            <div class="rec__note">Your longest run on any one habit. It stands whatever happens next.</div>
          </div>`) : raw('')}

        <div class="section-title"><span>How you did them</span></div>
        <div class="card">
          <div class="row-between" style="margin-bottom:8px">
            <span style="font-weight:700;font-size:.9rem">Full version</span>
            <span class="mono" style="font-weight:800">${Math.round(r.fullShare * 100)}%</span>
          </div>
          <div class="bar"><i style="width:${(r.fullShare * 100).toFixed(1)}%;background:var(--accent)"></i></div>
          <div style="margin-top:10px">
            ${raw(qaRow('And the rest were the two-minute version',
              'Which is the point of having one. The small version is not a lesser day — it is the thing that kept the habit alive on a day that would otherwise have been a zero. A high number here is good; a number at 100% usually means the habit is too easy.'))}
          </div>
        </div>

        ${r.automatic ? raw(h`
          <div class="section-title"><span>Past 66 days</span></div>
          <div class="card rec__wide">
            <div class="rec__n" style="color:var(--teal)">${r.automatic} of ${r.liveCount}</div>
            <div class="rec__l">habits older than the automaticity marker</div>
            <div class="rec__note">Median time for a habit to become automatic is 66 days (Lally et al., 2010). Age never goes backwards.</div>
          </div>`) : raw('')}

        ${r.cleanBest != null ? raw(h`
          <div class="section-title"><span>Shield</span></div>
          <div class="recgrid">
            ${raw(record(r.cleanBest, 'best clean run', 'days'))}
            ${raw(record(r.cleanLifetime, 'lifetime clean', 'never resets'))}
          </div>`) : raw('')}

        ${cb ? raw(comebackCard(cb)) : raw('')}
      </div>
    </div>`;
}

/**
 * The comeback record.
 *
 * The count of times you fell off and the count of times you came back are the
 * same number. That is arithmetic rather than encouragement, and it is the only
 * honest way to read this data if you are alive to read it at all.
 */
function comebackCard(cb) {
  return h`
    <div class="section-title"><span>Comebacks</span></div>
    <div class="card rec__wide" style="border-color:var(--purple)">
      <div class="rec__n" style="color:var(--purple-edge)">${cb.times}</div>
      <div class="rec__l">times you came back</div>
      <div class="rec__note">
        You have fallen off ${cb.times} ${cb.times === 1 ? 'time' : 'times'}, and come back
        ${cb.times === 1 ? 'once' : `all ${cb.times}`}. Those are the same number, and they always will be.
      </div>
    </div>
    <div class="recgrid">
      ${raw(record(cb.longestGap, 'longest gap', 'days away, and returned from'))}
      ${raw(record(cb.sinceLast, 'days since', cb.lastDay ? `last was ${prettyDay(cb.lastDay)}` : ''))}
    </div>
    ${cb.topCause ? raw(h`
      <div class="card" style="padding:12px 14px">
        ${raw(qaRow(h`Most common cause: ${cb.topCause.label}`,
          'Worth knowing, because it is the thing to write the if–then plan about. A cause that keeps recurring is a situation you can prepare for, not a character flaw you have to fix.'))}
      </div>`) : raw('')}`;
}

export function mountRecords() { /* static */ }

/* ----------------------------------------------------------------- clock */

function fmt(mins) {
  return mins == null ? '—' : prettyTime(mins);
}

export function renderClock() {
  const state = getState();
  const c = clock(state);

  if (c.total < 5) {
    return h`
      <div class="screen">
        <header class="screen__head">
          <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
          <h1 style="margin-top:6px">The clock</h1>
        </header>
        <div class="card">
          <p class="prose" style="margin:0">
            This needs a handful of completions before it says anything true. Keep going for a few days
            and it will show you when you actually do things — which is not always when you think.
          </p>
        </div>
      </div>`;
  }

  const size = 232;
  const cx = size / 2;
  const cy = size / 2;
  const rIn = 44;
  const rOut = 104;

  // One wedge per hour, length scaled by how often you finish something in it.
  const wedges = c.dial.map((slot, i) => {
    const a0 = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2 - Math.PI / 2;
    const len = c.max ? rIn + (rOut - rIn) * (slot.n / c.max) : rIn;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    const gap = 0.012;
    return `<path d="M ${p(rIn, a0 + gap)} L ${p(len, a0 + gap)}
      A ${len} ${len} 0 0 1 ${p(len, a1 - gap)} L ${p(rIn, a1 - gap)}
      A ${rIn} ${rIn} 0 0 0 ${p(rIn, a0 + gap)} Z"
      class="dial__w ${slot.n ? '' : 'is-empty'}"/>`;
  }).join('');

  // Labels every six hours, starting from the app's own day boundary.
  const ticks = c.dial.map((slot, i) => {
    if (i % 6) return '';
    const a = ((i + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
    const r = rOut + 14;
    return `<text class="dial__t" x="${(cx + r * Math.cos(a)).toFixed(1)}"
      y="${(cy + r * Math.sin(a)).toFixed(1)}" text-anchor="middle" dy=".35em">${String(slot.hour).padStart(2, '0')}</text>`;
  }).join('');

  return h`
    <div class="screen">
      <header class="screen__head" style="margin-bottom:12px">
        <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
        <h1 style="margin-top:6px">The clock</h1>
      </header>

      <div class="stack">
        <div class="card" style="text-align:center">
          <svg class="dial" viewBox="0 0 ${size} ${size}" role="img"
               aria-label="When you complete habits, by hour">
            ${raw(wedges)}${raw(ticks)}
            <text class="dial__c" x="${cx}" y="${cy - 6}" text-anchor="middle">${c.total}</text>
            <text class="dial__s" x="${cx}" y="${cy + 12}" text-anchor="middle">last 90 days</text>
          </svg>
          ${c.peakHour != null ? raw(h`
            <p class="prose" style="margin:6px 0 0">
              Most of what you finish lands between
              <strong>${fmt(c.peakHour * 60)}</strong> and <strong>${fmt((c.peakHour + 1) * 60)}</strong>.
            </p>`) : raw('')}
        </div>

        <div class="statgrid">
          <div class="stat"><div class="stat__n" style="font-size:1.15rem">${fmt(c.earliest)}</div><div class="stat__l">earliest ever</div></div>
          <div class="stat"><div class="stat__n" style="font-size:1.15rem">${fmt(c.latest)}</div><div class="stat__l">latest ever</div></div>
          <div class="stat"><div class="stat__n">${c.habits.length}</div><div class="stat__l">habits timed</div></div>
        </div>

        <div class="card" style="padding:10px 14px">
          ${raw(qaRow('Why the time matters more than it looks',
            'A habit you do at roughly the same time has a cue doing the work. A habit smeared across eight hours is one you are still deciding about every day, and deciding is the part that fails on a bad week. So the tight ones below are safe, and the scattered ones are the ones to give an anchor — a prayer, or the end of another habit.'))}
        </div>

        ${c.habits.length ? raw(h`
          <div class="section-title"><span>When each one happens</span></div>
          <div class="stack-sm">
            ${c.habits.map((row) => raw(habitTiming(row)))}
          </div>`) : raw(h`
          <div class="card"><p class="prose" style="margin:0">
            No habit has three timed completions yet. Give it a few more days.
          </p></div>`)}
      </div>
    </div>`;
}

function habitTiming(row) {
  const color = CATEGORIES[row.habit.category]?.color || 'var(--accent)';
  const hours = Math.floor(row.iqr / 60);
  const mins = row.iqr % 60;
  const spread = hours ? `${hours}h ${mins}m` : `${mins}m`;
  return h`
    <div class="card" style="padding:12px 14px">
      <div class="row-between" style="margin-bottom:7px;gap:10px">
        <span class="grow nowrap" style="font-weight:700;font-size:.92rem">${row.habit.title}</span>
        <span class="pill pill--${raw(row.verdict.tone)}">${row.verdict.label}</span>
      </div>
      <div class="timeline" style="--tl-color:${raw(color)}">
        <i style="left:${((row.from / 1440) * 100).toFixed(1)}%;
                  width:${(((row.to - row.from) / 1440) * 100).toFixed(1)}%"></i>
        <b style="left:${((row.median / 1440) * 100).toFixed(1)}%"></b>
      </div>
      <div class="row-between muted" style="font-size:.74rem;margin-top:5px;font-weight:700">
        <span>00:00</span><span>12:00</span><span>24:00</span>
      </div>
      <div class="muted" style="font-size:.8rem;margin-top:7px;font-weight:600">
        Usually <strong style="color:var(--text)">${fmt(row.median)}</strong>,
        spread of ${spread} across ${row.n} times.
      </div>
    </div>`;
}

export function mountClock() { /* static */ }
