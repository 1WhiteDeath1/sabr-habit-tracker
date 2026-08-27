// me.js — profile, statistics, the weekly review, settings, and the evidence index.
// Routes: #/me · #/me/settings · #/me/review · #/me/science

import { h, raw, esc, actions, haptic, toast, confirmSheet, bar, xpBurst, qa, qaRow } from '../ui/dom.js';
import { getState, mutate, exportJSON, importJSON, replaceState, flush } from '../core/store.js';
import { defaultState, XP, CATEGORIES } from '../core/schema.js';
import { levelFromXp, attrSummary } from '../core/game.js';
import { grantXp } from '../core/game.js';
import { dayProgress, streakOf, completionRate } from '../core/habits.js';
import { todayKey, lastNDays, weekOf, addDays, prettyDay, keyToDate, dayKey, daysBetween, rangeKeys } from '../core/dates.js';
import { spanWeeks, countdown, ageOn, weekLabel, isDayKey } from '../core/horizons.js';
import { recoveryStats } from '../core/recovery.js';
import { METHODS, prayerTimesFor } from '../core/prayer.js';
import { RESEARCH_LIST } from '../data/research.js';
import { heroCard, attrStrip, evidenceCard } from '../ui/widgets.js';
import { refresh, go } from '../core/router.js';
import { requestNotifications, notificationsSupported } from '../core/notify.js';
import { noor, restartTutorial } from './tutorial.js';
import { renderRecords, mountRecords, renderClock, mountClock, statsPeek } from './stats.js';
import { records } from '../core/stats.js';
import { canRecord, record, saveClip, deleteClip, playClip, MAX_SECONDS } from '../core/voice.js';
import { isOwned, nextUnlock } from '../core/unlocks.js';
import { wallet } from '../core/economy.js';
import { gateCard, gateMount } from '../ui/gate.js';
import { startCoach } from './coach.js';
import { icon } from '../ui/icons.js';

export const meScreen = {
  render(route) {
    const view = route.params[0];
    if (view === 'settings') return renderSettings();
    if (view === 'review')   return renderReview();
    if (view === 'science')  return renderScience();
    if (view === 'records')  return renderRecords();
    if (view === 'clock')    return renderClock();
    return renderProfile();
  },
  mount(root, route) {
    const view = route.params[0];
    if (view === 'settings') return mountSettings(root);
    if (view === 'review')   return mountReview(root);
    if (view === 'science')  return mountScience(root);
    if (view === 'records')  return mountRecords(root);
    if (view === 'clock')    return mountClock(root);
    return mountProfile(root);
  },
};

/* -------------------------------------------------------------- profile */

function renderProfile() {
  const state = getState();
  const lv = levelFromXp(state.game.xp);
  const rec = recoveryStats(state);
  const days = lastNDays(364);
  const logged = Object.keys(state.logs).length;
  const totalDone = Object.values(state.logs).reduce((n, day) => n + Object.keys(day).length, 0);
  const best = state.habits.filter((x) => !x.archived)
    .map((hab) => ({ hab, s: streakOf(hab, state) }))
    .sort((a, b) => b.s - a.s)[0];
  const thisWeekReviewed = state.reviews.some((r) => r.weekOfKey === weekOf(todayKey())[0]);

  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">Level ${lv.level}</div>
        <h1>${state.profile.name || 'Your record'}</h1>
      </header>

      <div class="stack">
        ${raw(heroCard(state, { rank: true }))}
        <div class="card">${raw(attrStrip(state))}</div>

        <div class="section-title"><span>Horizons</span></div>
        <div class="stack-sm">${raw(horizonCards(state))}</div>

        ${raw(statsPeek(state))}

        ${state.profile.identity ? raw(identityCard(state)) : raw('')}

        <div class="statgrid">
          <div class="stat"><div class="stat__n">${logged}</div><div class="stat__l">days logged</div></div>
          <div class="stat"><div class="stat__n">${totalDone}</div><div class="stat__l">habits done</div></div>
          <div class="stat"><div class="stat__n">${best?.s || 0}</div><div class="stat__l">best streak</div></div>
        </div>

        <div class="section-title"><span>Your shape</span></div>
        <div class="stack-sm">
          ${raw(attrRadar(state))}
          ${raw(rhythmChart(state))}
        </div>

        <div class="section-title"><span>The last year</span></div>
        <div class="card">
          <div class="yeargrid">${days.map((k) => raw(`<i data-l="${levelForDay(state, k)}" title="${esc(prettyDay(k))}"></i>`))}</div>
          <div class="row-between muted" style="font-size:.7rem;margin-top:9px">
            <span>${prettyDay(days[0])}</span><span>today</span>
          </div>
        </div>

        ${state.recovery.enabled ? raw(h`
          <div class="section-title"><span>Shield</span></div>
          <div class="statgrid">
            <div class="stat"><div class="stat__n">${rec.days}</div><div class="stat__l">current</div></div>
            <div class="stat"><div class="stat__n">${rec.best}</div><div class="stat__l">best</div></div>
            <div class="stat"><div class="stat__n">${rec.lifetime}</div><div class="stat__l">lifetime</div></div>
          </div>`) : raw('')}

        <div class="section-title"><span>Habit health</span></div>
        <div class="card stack-sm">
          ${state.habits.filter((x) => !x.archived).length ? raw(state.habits.filter((x) => !x.archived).map((hab) => {
            const rate = completionRate(hab, state, 30);
            const color = CATEGORIES[hab.category]?.color || 'var(--accent)';
            return h`
              <div>
                <div class="row-between" style="font-size:.85rem;margin-bottom:4px">
                  <span class="nowrap grow">${hab.title}</span>
                  <span class="mono muted">${Math.round(rate * 100)}%</span>
                </div>
                ${bar(rate, { color, height: 6 })}
              </div>`;
          }).join('')) : raw('<p class="prose" style="margin:0">No habits yet.</p>')}
        </div>

        <div class="section-title"><span>More</span></div>
        <div class="stack-sm">
          <div class="listrow" data-act="vault">
            <span class="listrow__icon">${icon('box')}</span>
            <span class="grow"><span style="display:block;font-weight:620">The wallet</span>
              <span class="muted" style="font-size:.78rem">${walletLine(state)}</span></span>
            <span class="listrow__chev">›</span>
          </div>
          <div class="listrow" data-act="review">
            <span class="listrow__icon">${icon('map')}</span>
            <span class="grow"><span style="display:block;font-weight:620">Weekly review</span>
              <span class="muted" style="font-size:.78rem">${thisWeekReviewed ? 'Done this week' : 'Not done this week · +60 XP'}</span></span>
            <span class="listrow__chev">›</span>
          </div>
          <div class="listrow" data-act="ledger">
            <span class="listrow__icon">${icon('ledger')}</span>
            <span class="grow"><span style="display:block;font-weight:620">The ledger</span>
              <span class="muted" style="font-size:.78rem">Muhasabah — what you left undone, and did wrong</span></span>
            <span class="listrow__chev">›</span>
          </div>
          <div class="listrow" data-act="science">
            <span class="listrow__icon">${icon('flask')}</span>
            <span class="grow"><span style="display:block;font-weight:620">The evidence</span>
              <span class="muted" style="font-size:.78rem">Every method in this app, with its citation</span></span>
            <span class="listrow__chev">›</span>
          </div>
          <div class="listrow" data-act="settings">
            <span class="listrow__icon">${icon('gear')}</span>
            <span class="grow"><span style="display:block;font-weight:620">Settings</span>
              <span class="muted" style="font-size:.78rem">Prayer times, backup, appearance</span></span>
            <span class="listrow__chev">›</span>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * The identity statement, with the count of times you have backed it.
 *
 * Every completed habit is a vote for the sentence. Printing the tally is what
 * turns it from something you hope is true into something you can check, and it
 * is the one number on this screen that is literally about who you are rather
 * than what you did this week.
 */
function identityCard(state) {
  const votes = records(state).total;
  return h`
    <div class="card card--accent identity">
      <div class="identity__label">Who you are becoming</div>
      <div class="identity__line">${state.profile.identity}</div>
      ${votes ? raw(h`
        <div class="identity__votes">
          <span class="identity__n">${votes.toLocaleString()}</span>
          <span class="identity__cap">${votes === 1 ? 'vote' : 'votes'} cast for that sentence</span>
        </div>
        <p class="identity__note">
          Every habit you finished was one. You do not have to believe the line \u2014
          it is just what the record says you have been doing.
        </p>`) : raw(h`
        <p class="identity__note">Finish one habit and the tally under this starts counting.</p>`)}
    </div>`;
}

function levelForDay(state, key) {
  const p = dayProgress(state, key);
  if (!p.total || !p.done) return 0;
  if (p.pct >= 1) return 4;
  if (p.pct >= 0.66) return 3;
  if (p.pct >= 0.33) return 2;
  return 1;
}

/* ------------------------------------------------------------ horizons */
/* One picture, not three cards.
   Every week of an average life is a block, laid out 52 to a row so each row is
   one year. The colour of a block says which phase of the life that week belongs
   to — the degree and the marriage date are bands inside the same grid rather
   than separate widgets, because the only way to see that a four-year degree is
   a thin stripe, or that almost all of married life is still blank, is to see
   them against the whole thing.
   Phases are worked out one week at a time, which is what the legend counts,
   and only then grouped into blocks for drawing. Keeping those two steps apart
   is what lets the grid stay as sparse as it has always been without the
   numbers underneath it losing their resolution. */

/* Roughly how many blocks the grid should draw. A whole life at one block per
   week is ~3,900 marks, which is too dense to read on a phone; at this target
   each block covers about a month and the grid keeps the density it had before
   the phases were added. */
const BLOCK_TARGET = 900;

/* Every phase a week can be in. The colours live in styles.css against the same
   ids, so a block and its legend swatch can never drift apart. */
const PHASE_IDS = ['spent', 'uniDone', 'now', 'uniLeft', 'left', 'wed', 'married'];

function horizonCards(state) {
  if (!isDayKey(state.profile.birthDate)) {
    return setupCard({
      icon: icon('hourglass'), title: 'Life in weeks',
      body: 'Add your date of birth in Settings and this becomes a picture of how much time you have actually got — with your degree and the date you are planning to marry drawn inside it. It is uncomfortable on purpose.',
    });
  }
  return lifeCard(state);
}

function setupCard({ icon, title, body }) {
  return h`
    <div class="card">
      <div class="card__title">${icon} ${title}</div>
      <p class="prose" style="margin:0 0 10px">${body}</p>
      <a class="btn btn--ghost btn--sm" href="#/me/settings">Add it</a>
    </div>`;
}

/** "18 December 2026" — a horizon is years away, so the year is not optional. */
function longDate(key) {
  return keyToDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function lifeCard(state) {
  const p = state.profile;
  const years = Math.max(30, Math.min(120, Math.round(p.lifeExpectancy) || 75));
  const totalWeeks = years * 52;

  // Which week of your life a date falls in. Whole weeks since birth, so the
  // grid and every number under it are counted the same way.
  const weekOfLife = (key) => Math.floor(daysBetween(p.birthDate, key) / 7);

  const nowIdx = Math.max(0, weekOfLife(todayKey()));
  const uni = spanWeeks(p.uniStart, p.uniEnd);          // null unless both dates are real
  const uniFrom = uni ? weekOfLife(p.uniStart) : null;
  const uniTo = uni ? weekOfLife(p.uniEnd) : null;
  const wedIdx = isDayKey(p.marriageDate) ? weekOfLife(p.marriageDate) : null;

  // Step one: every week gets a phase. Resolution order is the priority order —
  // the week you are in wins over the band it sits inside, and a past week is
  // spent whatever was planned for it. This is what the legend counts, so the
  // numbers stay in weeks however coarsely the grid ends up drawn.
  const tally = Object.fromEntries(PHASE_IDS.map((id) => [id, 0]));
  const weeks = new Array(totalWeeks);
  for (let i = 0; i < totalWeeks; i++) {
    let phase;
    if (i === nowIdx) phase = 'now';
    else if (wedIdx !== null && i === wedIdx) phase = 'wed';
    else if (uni && i >= uniFrom && i <= uniTo) phase = i < nowIdx ? 'uniDone' : 'uniLeft';
    else if (i < nowIdx) phase = 'spent';
    else if (wedIdx !== null && i > wedIdx) phase = 'married';
    else phase = 'left';
    tally[phase] += 1;
    weeks[i] = phase;
  }

  // Step two: group those weeks into the blocks actually drawn.
  const per = Math.max(1, Math.ceil(totalWeeks / BLOCK_TARGET));
  const cells = [];
  for (let i = 0; i < totalWeeks; i += per) {
    cells.push(`<i data-p="${blockPhase(weeks, i, Math.min(totalWeeks, i + per))}"></i>`);
  }

  return h`
    <div class="card">
      <div class="card__title">${icon('hourglass')} Life in weeks</div>
      <div class="weeks" aria-hidden="true">${raw(cells.join(''))}</div>
      <div class="legend">${raw(legendRows(state, tally, uni, wedIdx, totalWeeks, nowIdx))}</div>
      <div style="margin-top:12px">
        ${raw(qa(h`<p><strong>${totalWeeks.toLocaleString()}</strong> weeks in a ${years}-year life,
          ${per === 1 ? 'one block each' : `about ${per} to a block`}.
          <strong>${nowIdx.toLocaleString()}</strong> of them are behind you.
          ${uni ? raw('The blue stripe is the entire degree — it is smaller than it feels from inside it.') : raw('')}</p>
          ${raw(footnotes(state, uni, wedIdx, totalWeeks))}
          <p>"Take advantage of five before five: … your free time before your preoccupation, and your life before your death." — al-Hakim 7846</p>`))}
      </div>
    </div>`;
}

/**
 * The phase for one block of the grid, covering weeks [from, to).
 * The week you are in and the week you marry are single weeks that would
 * otherwise vanish inside a block, so they win outright; everything else takes
 * whichever phase fills most of the block, which keeps the bands the right size.
 */
function blockPhase(weeks, from, to) {
  const counts = {};
  let best = weeks[from];
  let bestN = 0;
  let hasWed = false;
  for (let i = from; i < to; i++) {
    const phase = weeks[i];
    if (phase === 'now') return 'now';
    if (phase === 'wed') hasWed = true;
    counts[phase] = (counts[phase] || 0) + 1;
    if (counts[phase] > bestN) { bestN = counts[phase]; best = phase; }
  }
  return hasWed ? 'wed' : best;
}

/** One row per phase: the swatch that appears in the grid, what it is, how many. */
function legendRows(state, tally, uni, wedIdx, totalWeeks, nowIdx) {
  const p = state.profile;
  const rows = [];

  const row = (id, label, value) => rows.push(h`
    <div class="legend__row">
      <i class="legend__sw" data-p="${id}"></i>
      <span class="legend__label grow nowrap">${label}</span>
      <span class="legend__val">${value}</span>
    </div>`);

  // No data-p on the empty swatch: it is deliberately colourless, and carrying
  // a phase id would let the phase colour override the dashed placeholder.
  const prompt = (label, cta) => rows.push(h`
    <a class="legend__row" href="#/me/settings">
      <i class="legend__sw legend__sw--empty"></i>
      <span class="legend__label grow nowrap">${label}</span>
      <span class="legend__val legend__val--cta">${cta} ›</span>
    </a>`);

  row('spent', 'Already spent', `${tally.spent.toLocaleString()} weeks`);

  if (uni) {
    // Counted from the dates rather than from the blocks: the week you are in,
    // and a marriage week falling inside the degree, are drawn in their own
    // colour and would otherwise be missing from the answer.
    if (uni.weeksDone) row('uniDone', 'University \u00b7 done', `${uni.weeksDone.toLocaleString()} weeks`);
    if (uni.weeksLeft) row('uniLeft', 'University \u00b7 left', `${uni.weeksLeft.toLocaleString()} weeks`);
  } else {
    prompt('University', 'Add your dates');
  }

  row('now', 'This week', 'you are here');

  if (wedIdx === null) {
    if (tally.left) row('left', 'Still yours', `${tally.left.toLocaleString()} weeks`);
    prompt('Marriage', 'Add the date');
  } else if (wedIdx < nowIdx) {
    // The date has passed. It is still a real boundary, just behind you.
    row('wed', 'Marriage', longDate(p.marriageDate));
    if (tally.married) row('married', 'Married life ahead', `${tally.married.toLocaleString()} weeks`);
  } else {
    const age = ageOn(p.birthDate, p.marriageDate);
    if (tally.left) row('left', 'Between now and it', `${tally.left.toLocaleString()} weeks`);
    row('wed', 'Marriage', age == null ? longDate(p.marriageDate) : `${longDate(p.marriageDate)} \u00b7 age ${age}`);
    // Zero here means the date sits past the end of the grid; the footnote says so.
    if (tally.married) row('married', 'After marriage', `${tally.married.toLocaleString()} weeks`);
  }

  return rows.join('');
}

/** The lines under the grid that a block cannot say on its own: exact dates,
 *  the current semester, and how the two horizons sit against each other. */
function footnotes(state, uni, wedIdx, totalWeeks) {
  const p = state.profile;
  const out = [];

  if (uni) {
    if (uni.phase === 'before') {
      const until = Math.max(0, Math.round(daysBetween(todayKey(), p.uniStart) / 7));
      out.push(h`The degree has not started yet — ${weekLabel(until)} until the first day.`);
    } else if (uni.phase === 'after') {
      out.push(h`The degree is finished: ${weekLabel(uni.totalWeeks)}, start to finish.`);
    } else {
      out.push(h`Graduation lands on <strong>${longDate(p.uniEnd)}</strong>, ${weekLabel(uni.weeksLeft)} from here.`);
    }
    const sem = semesterLine(state);
    if (sem) out.push(sem);
  }

  if (wedIdx !== null) {
    const cd = countdown(p.marriageDate);
    if (cd.past) {
      out.push(h`${longDate(p.marriageDate)} is ${weekLabel(cd.weeks)} behind you. If it moved, move it in Settings.`);
    } else {
      out.push(h`That is ${cd.absDays.toLocaleString()} days away, and every block before it is preparation whether you use it as such or not.`);
      if (isDayKey(p.uniEnd)) {
        const gap = Math.round(daysBetween(p.uniEnd, p.marriageDate) / 7);
        out.push(gap >= 0
          ? h`It falls ${weekLabel(gap)} after you are due to graduate.`
          : h`It falls ${weekLabel(gap)} <em>before</em> you are due to graduate — you would be a student and a husband in the same week.`);
      }
    }
    if (wedIdx >= totalWeeks) {
      out.push(h`On this life expectancy that date sits past the end of the grid, so it has no block of its own.`);
    }
  }

  if (!out.length) return '';
  return `<p>${out.join('<br>')}</p>`;
}

/** "Fall 2026 — week 6 of 14." Only when the academics module holds the dates. */
function semesterLine(state) {
  const a = state.academics;
  if (!a.enabled) return '';
  const span = spanWeeks(a.semester.startDate, a.semester.endDate);
  if (!span) return '';
  const name = a.semester.name || 'This semester';
  if (span.phase === 'before') return h`${name} starts ${prettyDay(a.semester.startDate)}.`;
  if (span.phase === 'after') return h`${name} is over — ${weekLabel(span.totalWeeks)}, done.`;
  return h`${name} — week ${span.weeksDone + 1} of ${span.totalWeeks}, ${weekLabel(span.weeksLeft)} to go.`;
}

function mountProfile(root) {
  actions(root, {
    vault: () => go('vault'),
    review:   () => go('me/review'),
    ledger:   () => go('ledger'),
    science:  () => go('me/science'),
    settings: () => go('me/settings'),
  });
}

/* --------------------------------------------------------------- review */

function renderReview() {
  const state = getState();
  const week = weekOf(todayKey());
  const prev = weekOf(addDays(week[0], -1));
  const done = state.reviews.find((r) => r.weekOfKey === week[0]);

  const stats = week.filter((k) => k <= todayKey()).map((k) => dayProgress(state, k));
  const avg = stats.length ? stats.reduce((s, p) => s + p.pct, 0) / stats.length : 0;
  const prevStats = prev.map((k) => dayProgress(state, k));
  const prevAvg = prevStats.length ? prevStats.reduce((s, p) => s + p.pct, 0) / prevStats.length : 0;
  const delta = Math.round((avg - prevAvg) * 100);

  const habits = state.habits.filter((x) => !x.archived)
    .map((hab) => ({ hab, rate: completionRate(hab, state, 7) }))
    .sort((a, b) => a.rate - b.rate);
  const weakest = habits[0];
  const strongest = habits[habits.length - 1];

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
        <div class="eyebrow" style="margin-top:8px">Week of ${prettyDay(week[0])}</div>
        <h1>Weekly review</h1>
      </header>

      <div class="stack">
        ${done ? raw(h`<div class="card card--accent"><p class="prose" style="margin:0">You already reviewed this week. Editing below will update it.</p></div>`) : raw('')}

        <div class="statgrid">
          <div class="stat"><div class="stat__n">${Math.round(avg * 100)}%</div><div class="stat__l">this week</div></div>
          <div class="stat"><div class="stat__n">${delta >= 0 ? '+' : ''}${delta}</div><div class="stat__l">vs last</div></div>
          <div class="stat"><div class="stat__n">${state.focus.sessions.filter((s) => week.includes(dayKey(new Date(s.at)))).length}</div><div class="stat__l">focus blocks</div></div>
        </div>

        <div class="card">
          <div class="card__title">${icon('chart')} What the data says</div>
          <p class="prose" style="margin:0">
            ${strongest && strongest.rate > 0 ? raw(h`Strongest: <strong>${strongest.hab.title}</strong> at ${Math.round(strongest.rate * 100)}%. `) : raw('')}
            ${weakest && weakest.rate < 0.5 ? raw(h`Weakest: <strong>${weakest.hab.title}</strong> at ${Math.round(weakest.rate * 100)}% — either shrink it to its two-minute version or give it a better cue. Do not just try harder at it.`) : raw('Nothing is badly off track.')}
          </p>
        </div>

        <label class="field">
          <span>What worked — keep it</span>
          <textarea id="rv-kept" placeholder="Fajr held all seven days because the phone was in the kitchen.">${done?.kept || ''}</textarea>
        </label>
        <label class="field">
          <span>What did not — and why, specifically</span>
          <textarea id="rv-drop" placeholder="Skipped the gym on the days I stayed up past 1am. It is a sleep problem, not a gym problem.">${done?.drop || ''}</textarea>
        </label>
        <label class="field">
          <span>One change for next week. One.</span>
          <textarea id="rv-change" placeholder="Phone goes in the kitchen at 22:30, alarm on the clock instead.">${done?.change || ''}</textarea>
          <span class="hint">Changing one thing and keeping it beats changing five and keeping none.</span>
        </label>

        ${raw(evidenceCard('freshStart', { full: true }))}

        <button class="btn btn--primary btn--lg btn--block" data-act="save">${done ? 'Update review' : 'Complete review · +60 XP'}</button>
      </div>
    </div>`;
}

function mountReview(root) {
  actions(root, {
    save: (el) => {
      const week = weekOf(todayKey())[0];
      const payload = {
        weekOfKey: week,
        at: Date.now(),
        kept: root.querySelector('#rv-kept').value.trim(),
        drop: root.querySelector('#rv-drop').value.trim(),
        change: root.querySelector('#rv-change').value.trim(),
      };
      const existed = getState().reviews.some((r) => r.weekOfKey === week);
      mutate((s) => {
        const i = s.reviews.findIndex((r) => r.weekOfKey === week);
        if (i >= 0) s.reviews[i] = payload; else s.reviews.push(payload);
      });
      if (!existed) {
        grantXp(XP.weeklyReview, 'aql');
        xpBurst(XP.weeklyReview, el);
        haptic([20, 50, 20, 50, 70]);
        toast('Review logged. That is the whole point of the week.', { icon: icon('map'), tone: 'good' });
      } else {
        toast('Review updated');
      }
      go('me');
    },
  });
}

/* -------------------------------------------------------------- science */

function renderScience() {
  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
        <h1 style="margin-top:6px">The evidence</h1>
      </header>
      <p class="muted" style="font-size:.86rem;line-height:1.55;margin-bottom:16px">
        Every mechanic in this app and the work it comes from. Where the popular version of a finding
        overstates it, the entry says so — an app that oversells its science is a poster with a database.
      </p>
      <div class="stack-sm">
        ${RESEARCH_LIST.map((r) => raw(h`
          <div class="card">
            <div class="card__title">${r.title}</div>
            <p class="prose" style="margin:0 0 8px">${r.detail}</p>
            <div class="evidence__cite">${r.cite}</div>
            <div class="pill pill--wrap" style="margin-top:9px">Used for: ${r.used}</div>
          </div>`))}
      </div>
    </div>`;
}

function mountScience() { /* static */ }

/* ------------------------------------------------------------- settings */

function renderSettings() {
  const state = getState();
  const s = state.settings;
  const p = state.profile;
  const times = prayerTimesFor(todayKey(), s);

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/me" class="muted" style="font-size:.85rem">‹ Me</a>
        <h1 style="margin-top:6px">Settings</h1>
      </header>

      <div class="stack">
        <div class="section-title"><span>You</span></div>
        <label class="field"><span>Name</span><input type="text" id="st-name" value="${p.name}" placeholder="What should it call you?"></label>
        <label class="field">
          <span>Identity statement</span>
          <input type="text" id="st-identity" value="${p.identity}" placeholder="I am someone who keeps his word to himself.">
          <span class="hint">Written as who you are, not what you want. Each repetition is a vote for it.</span>
        </label>
        <label class="field">
          <span>Why you are doing all this</span>
          <textarea id="st-why" placeholder="The thing you would say out loud if no one was listening.">${p.why}</textarea>
          <span class="hint">Read back to you when an urge hits, and nowhere else.</span>
        </label>
        ${raw(voiceField(state))}

        <label class="field">
          <span>Who you want to be ready for</span>
          <input type="text" id="st-forwhom" value="${p.forWhom || ''}"
                 placeholder="Be the man she would choose.">
          <span class="hint">One line, kept on this phone only. It appears on the SOS screen,
            because that is the moment it is worth something.</span>
        </label>

        <div class="section-title"><span>Horizons</span></div>
        <div class="card" style="padding:10px 14px">
          ${raw(qaRow('What these dates do',
            'They are what the Me screen draws. Leave any of them blank and that band simply does not appear — nothing here is estimated on your behalf.'))}
        </div>
        <label class="field">
          <span>Date of birth</span>
          <input type="date" id="st-birth" value="${p.birthDate || ''}">
          <span class="hint">Powers the life-in-weeks grid, and your age at the marriage date.</span>
        </label>
        <label class="field">
          <span>Life expectancy</span>
          <input type="number" id="st-life" min="30" max="120" step="1" value="${p.lifeExpectancy || 75}">
          <span class="hint">Only the denominator of the life grid. It is an average, not a forecast, and no one is owed it.</span>
        </label>
        <label class="field">
          <span>University \u2014 first day</span>
          <input type="date" id="st-unistart" value="${p.uniStart || ''}">
        </label>
        <label class="field">
          <span>University \u2014 expected graduation</span>
          <input type="date" id="st-uniend" value="${p.uniEnd || ''}">
          <span class="hint">The end of the whole degree, not this semester. The semester comes from the Academics tab.</span>
        </label>
        <label class="field">
          <span>Marriage \u2014 the date you are planning around</span>
          <input type="date" id="st-marry" value="${p.marriageDate || ''}">
          <span class="hint">A working assumption so the time between here and there stops being vague. Change it whenever it changes.</span>
        </label>

        <div class="section-title"><span>Prayer times</span></div>
        <label class="field">
          <span>Source</span>
          <select id="st-prayermode">
            <option value="manual" ${s.prayerMode === 'manual' ? 'selected' : ''}>I will type them in</option>
            <option value="auto" ${s.prayerMode === 'auto' ? 'selected' : ''}>Calculate from my location</option>
          </select>
        </label>

        <div id="st-auto" class="${s.prayerMode === 'auto' ? '' : 'hidden'}">
          <div class="card">
            <div class="row-between">
              <div class="grow">
                <div style="font-weight:620">${s.location ? s.location.label || `${s.location.lat.toFixed(3)}, ${s.location.lon.toFixed(3)}` : 'No location set'}</div>
                <div class="muted" style="font-size:.78rem">Stored on this phone only. Never sent anywhere.</div>
              </div>
              <button class="btn btn--ghost btn--sm" data-act="locate">Use GPS</button>
            </div>
          </div>
          <label class="field" style="margin-top:12px">
            <span>Calculation method</span>
            <select id="st-method">
              ${Object.entries(METHODS).map(([k, m]) => raw(h`<option value="${k}" ${s.calcMethod === k ? 'selected' : ''}>${m.label}</option>`))}
            </select>
          </label>
          <label class="field">
            <span>Asr</span>
            <select id="st-asr">
              <option value="standard" ${s.asrMethod === 'standard' ? 'selected' : ''}>Standard (Shafi‘i, Maliki, Hanbali)</option>
              <option value="hanafi" ${s.asrMethod === 'hanafi' ? 'selected' : ''}>Hanafi</option>
            </select>
          </label>
        </div>

        <div id="st-manual" class="${s.prayerMode === 'manual' ? '' : 'hidden'}">
          <div class="card stack-sm">
            ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => raw(h`
              <label class="row-between" style="gap:12px">
                <span style="text-transform:capitalize;font-size:.92rem">${k}</span>
                <input type="time" data-prayer="${k}" value="${s.manualPrayers[k] || ''}" style="width:140px">
              </label>`))}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:7px">Today, as the app sees it</div>
          <div class="row wrap" style="gap:6px">
            ${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => raw(h`
              <span class="pill mono">${k} ${fmtMin(times[k])}</span>`))}
          </div>
        </div>

        <div class="section-title"><span>Day targets</span></div>
        <label class="field"><span>Wake time</span><input type="time" id="st-wake" value="${s.wakeTarget}"></label>
        <label class="field"><span>Lights out</span><input type="time" id="st-sleep" value="${s.sleepTarget}"></label>

        <div class="section-title"><span>App</span></div>
        <div class="card">
          <label class="switch"><span>Dark theme</span><input type="checkbox" id="st-theme" ${s.theme === 'dark' ? 'checked' : ''}></label>
          <label class="switch"><span>Show Arabic text</span><input type="checkbox" id="st-arabic" ${s.arabic ? 'checked' : ''}></label>
          <label class="switch"><span>Vibration feedback</span><input type="checkbox" id="st-haptics" ${s.haptics ? 'checked' : ''}></label>
          <label class="switch"><span>Sound</span><input type="checkbox" id="st-sound" ${s.sound !== false ? 'checked' : ''}></label>
        </div>

        <div class="section-title"><span>Reminders</span></div>
        <div class="card">
          <p class="prose" style="margin:0 0 10px">
            ${notificationsSupported()
              ? 'A web app can only reliably notify you while it is open or recently used — Android does not let it schedule alarms weeks ahead the way a store app can. For the ones that must not be missed, set a normal phone alarm as well.'
              : 'This browser does not support notifications. Use your phone’s own alarms for the habits that must not be missed.'}
          </p>
          ${notificationsSupported() ? raw(h`<button class="btn btn--ghost btn--sm" data-act="notify">
            ${Notification.permission === 'granted' ? 'Notifications allowed' : 'Allow notifications'}</button>`) : raw('')}
        </div>

        <div class="section-title"><span>Help</span></div>
        <button class="listrow" data-act="tour" style="width:100%;text-align:left">
          <span class="listrow__icon" style="padding:0">${raw(noor('wink'))}</span>
          <span class="grow"><span style="display:block;font-weight:620">Show me around again</span>
            <span class="muted" style="font-size:.78rem">The full tour \u2014 the cards, then the real screen</span></span>
          <span class="listrow__chev">\u203A</span>
        </button>
        <button class="listrow" data-act="coach" style="width:100%;text-align:left">
          <span class="listrow__icon">${icon('pointer')}</span>
          <span class="grow"><span style="display:block;font-weight:620">Just point at things</span>
            <span class="muted" style="font-size:.78rem">Skip the cards, label the buttons on Today</span></span>
          <span class="listrow__chev">\u203A</span>
        </button>

        <div class="section-title"><span>Your data</span></div>
        <div class="card">
          <p class="prose" style="margin:0 0 12px">
            Everything lives in this browser's storage on this phone. There is no account and no server.
            That also means <strong>clearing your browser data deletes it</strong> — so export a backup now and then.
          </p>
          <div class="row wrap" style="gap:8px">
            <button class="btn btn--ghost btn--sm" data-act="export">Export backup</button>
            <button class="btn btn--ghost btn--sm" data-act="import">Import backup</button>
          </div>
        </div>

        <button class="btn btn--danger btn--block" data-act="reset" style="margin-top:8px">Erase everything and start over</button>

        <p class="muted center" style="font-size:.74rem;margin-top:16px;line-height:1.6">
          Sabr · built to be used, not admired.<br>
          Translations are conveyed meanings — verify against a mushaf.
        </p>
      </div>
    </div>`;
}

/**
 * Record twenty seconds of yourself, for the SOS screen to play back.
 *
 * Written text is read in your own flat internal narrator, which is the voice
 * already losing the argument at the moment it matters. A recording arrives
 * with the conviction you had when you made it, and it cannot be waved off as
 * generic because it is audibly you.
 */
function voiceField(state) {
  if (!canRecord()) return '';
  if (!isOwned('voice', state)) return gateCard('voice');
  const has = state.profile.hasVoice;
  return h`
    <div class="field">
      <span>A message to yourself</span>
      <div class="card voicecard" id="voice-card">
        <p class="voicecard__copy">
          ${has
            ? raw(h`Recorded. It plays on the SOS screen, where reading is hardest.`)
            : raw(h`Say why you started, out loud, while you are calm. Up to ${MAX_SECONDS} seconds.
                    It never leaves this phone and is not included in a backup.`)}
        </p>
        <div class="row wrap" style="gap:8px;margin-top:10px">
          <button class="btn btn--primary btn--sm" data-act="rec">${has ? 'Record again' : 'Record'}</button>
          ${has ? raw(h`<button class="btn btn--ghost btn--sm" data-act="playown">Play</button>
                        <button class="btn btn--ghost btn--sm" data-act="delvoice">Delete</button>`) : raw('')}
        </div>
      </div>
    </div>`;
}

/** One line summarising the whole economy, for the More list. */
function walletLine(state) {
  const w = wallet(state);
  const next = nextUnlock(state);
  const free = `${w.balance.toLocaleString()} XP free`;
  if (!next) return `${free} · everything unlocked`;
  if (next.phase === 'buyable') return `${free} · ${next.def.label} is affordable now`;
  if (next.phase === 'broke') return `${free} · ${next.short} short of ${next.def.label.toLowerCase()}`;
  return `${free} · ${next.def.label} at level ${next.opensAt}`;
}

/* ====================================================================== */
/* The shape of it.                                                       */
/*                                                                        */
/* The five attributes were five numbers in a row, which tells you what    */
/* they are and nothing about how they relate. A pentagon tells you the    */
/* thing the numbers cannot: whether you are building a person or a        */
/* spike. That is the fact worth being proud of, or worth noticing.        */
/* ====================================================================== */

/**
 * The attribute pentagon.
 *
 * Radius is scaled against your own strongest attribute rather than an
 * absolute ceiling, so the shape is always readable — an absolute scale would
 * render a beginner as a dot in the middle and tell them nothing. The faint
 * outer ring is your best, so the gaps are the story.
 */
function attrRadar(state) {
  const attrs = attrSummary(state);
  const size = 200;
  const c = size / 2;
  const rMax = 74;
  const peak = Math.max(1, ...attrs.map((a) => a.level));

  const pt = (i, r) => {
    const ang = (-90 + i * (360 / attrs.length)) * (Math.PI / 180);
    return [c + Math.cos(ang) * r, c + Math.sin(ang) * r];
  };
  const poly = (r) => attrs.map((_, i) => pt(i, typeof r === 'function' ? r(i) : r).map((n) => n.toFixed(1)).join(',')).join(' ');

  const shape = poly((i) => (attrs[i].level / peak) * rMax);
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    `<polygon class="radar__ring" points="${poly(rMax * f)}"/>`).join('');
  const spokes = attrs.map((_, i) => {
    const [x, y] = pt(i, rMax);
    return `<line class="radar__spoke" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');
  const dots = attrs.map((a, i) => {
    const [x, y] = pt(i, (a.level / peak) * rMax);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${a.color}"/>`;
  }).join('');
  const labels = attrs.map((a, i) => {
    const [x, y] = pt(i, rMax + 17);
    return `<text class="radar__lbl" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
             text-anchor="middle" dominant-baseline="middle" fill="${a.color}">${a.level}</text>`;
  }).join('');

  return h`
    <div class="card radarcard">
      ${raw(qaRow('The shape of you',
        'Each corner is one attribute and the distance out is its level, measured against your own strongest one rather than a fixed ceiling — so this is about balance, not size. A spike means one part of your life is carrying the whole app. A wide even shape is the thing to aim at, and it is much harder than a spike.'))}
      <div class="radarcard__body">
        <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Attribute balance">
          ${raw(rings)}${raw(spokes)}
          <polygon class="radar__fill" points="${shape}"/>
          ${raw(dots)}${raw(labels)}
        </svg>
        <div class="radarkey">
          ${attrs.map((a) => raw(h`
            <div class="radarkey__r">
              <span class="radarkey__d" style="background:${raw(a.color)}"></span>
              <span class="grow">${a.label}</span>
              <span class="radarkey__n">${a.level}</span>
            </div>`))}
        </div>
      </div>
    </div>`;
}

/**
 * Twelve weeks of completions, as bars.
 *
 * The year grid answers "did I turn up", one pixel per day. This answers the
 * question that actually predicts whether you are still here in March: is the
 * trend going up. Bars are scaled to the tallest week so a quiet stretch still
 * reads as bars rather than as an empty chart.
 */
function rhythmChart(state) {
  const WEEKS = 12;
  const today = todayKey();
  const weeks = [];
  for (let w = WEEKS - 1; w >= 0; w -= 1) {
    const end = addDays(today, -w * 7);
    const start = addDays(end, -6);
    let n = 0;
    for (const day of rangeKeys(start, end)) {
      const log = state.logs[day];
      if (!log) continue;
      n += Object.values(log).filter((e) => e && (e.status === 'done' || e.status === 'partial')).length;
    }
    weeks.push({ n, start, end, current: w === 0 });
  }

  const peak = Math.max(1, ...weeks.map((w) => w.n));
  const total = weeks.reduce((a, w) => a + w.n, 0);
  // Compare the last four weeks with the four before them — a month is long
  // enough to be a trend and short enough to still be about now.
  const recent = weeks.slice(-4).reduce((a, w) => a + w.n, 0);
  const prior = weeks.slice(-8, -4).reduce((a, w) => a + w.n, 0);
  const delta = prior ? Math.round(((recent - prior) / prior) * 100) : null;

  return h`
    <div class="card rhythm">
      <div class="row-between">
        <span class="card__title" style="margin:0">Last twelve weeks</span>
        ${delta !== null ? raw(h`
          <span class="pill ${delta >= 0 ? 'pill--green' : ''}">
            ${delta >= 0 ? '+' : ''}${delta}% vs the month before
          </span>`) : raw('')}
      </div>

      <div class="rhythm__bars">
        ${weeks.map((w) => raw(h`
          <div class="rhythm__col ${w.current ? 'is-now' : ''}" title="${prettyDay(w.start)} — ${w.n} done">
            <div class="rhythm__bar" style="height:${Math.max(3, (w.n / peak) * 100).toFixed(1)}%"></div>
          </div>`))}
      </div>
      <div class="rhythm__foot">
        <span>${total} completed in twelve weeks</span>
        <span>best week ${peak}</span>
      </div>
    </div>`;
}

function fmtMin(m) {
  if (m == null) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function mountSettings(root) {
  gateMount(root);
  const bindText = (sel, apply) => {
    const el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener('change', () => { mutate(apply(el)); flush(); });
  };

  bindText('#st-name',     (el) => (s) => { s.profile.name = el.value.trim(); });
  bindText('#st-identity', (el) => (s) => { s.profile.identity = el.value.trim(); });
  bindText('#st-why',      (el) => (s) => { s.profile.why = el.value.trim(); });
  bindText('#st-forwhom',  (el) => (s) => { s.profile.forWhom = el.value.trim(); });
  bindText('#st-birth',    (el) => (s) => { s.profile.birthDate = el.value || null; });
  bindText('#st-unistart', (el) => (s) => { s.profile.uniStart = el.value || null; });
  bindText('#st-uniend',   (el) => (s) => { s.profile.uniEnd = el.value || null; });
  bindText('#st-marry',    (el) => (s) => { s.profile.marriageDate = el.value || null; });
  bindText('#st-life',     (el) => (s) => {
    // Clamped rather than rejected: a typo here should not blank the life grid.
    const n = Math.round(Number(el.value));
    s.profile.lifeExpectancy = Number.isFinite(n) ? Math.min(120, Math.max(30, n)) : 75;
  });
  bindText('#st-wake',     (el) => (s) => { s.settings.wakeTarget = el.value; });
  bindText('#st-sleep',    (el) => (s) => { s.settings.sleepTarget = el.value; });
  bindText('#st-method',   (el) => (s) => { s.settings.calcMethod = el.value; });
  bindText('#st-asr',      (el) => (s) => { s.settings.asrMethod = el.value; });

  root.querySelector('#st-prayermode')?.addEventListener('change', (ev) => {
    mutate((s) => { s.settings.prayerMode = ev.target.value; });
    refresh();
  });

  root.addEventListener('change', (ev) => {
    const pr = ev.target.closest('[data-prayer]');
    if (pr) {
      mutate((s) => { s.settings.manualPrayers[pr.dataset.prayer] = pr.value; });
      refresh();
      return;
    }
    if (ev.target.id === 'st-theme') {
      const dark = ev.target.checked;
      mutate((s) => { s.settings.theme = dark ? 'dark' : 'light'; });
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }
    if (ev.target.id === 'st-arabic')  { mutate((s) => { s.settings.arabic = ev.target.checked; }); }
    if (ev.target.id === 'st-haptics') {
      mutate((s) => { s.settings.haptics = ev.target.checked; });
      import('../ui/dom.js').then((m) => m.setHaptics(ev.target.checked));
    }
    if (ev.target.id === 'st-sound') {
      const on = ev.target.checked;
      mutate((s) => { s.settings.sound = on; });
      import('../core/audio.js').then((m) => {
        m.setSound(on);
        if (on) m.sfx('done');     // so you can hear what you just turned on
      });
    }
  });

  actions(root, {
    tour: () => restartTutorial(),
    coach: () => startCoach(),

    locate: async (el) => {
      if (!navigator.geolocation) { toast('This browser has no location access', { tone: 'warn' }); return; }
      el.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mutate((s) => {
            s.settings.location = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'My location' };
            s.settings.prayerMode = 'auto';
          });
          toast('Location saved on this device', { tone: 'good' });
          refresh();
        },
        (err) => { el.textContent = 'Use GPS'; toast(`Could not get location: ${err.message}`, { tone: 'warn' }); },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
      );
    },

    notify: async (el) => {
      const granted = await requestNotifications();
      toast(granted ? 'Notifications allowed' : 'Notifications were not granted', { tone: granted ? 'good' : 'warn' });
      refresh();
    },

    rec: async (el) => {
      const card = document.getElementById('voice-card');
      let handle;
      try {
        handle = await record({
          onTick: (secs) => {
            el.textContent = `Stop \u00b7 ${secs.toFixed(0)}s`;
          },
        });
      } catch (err) {
        toast('No microphone access. Allow it in your browser settings.', { tone: 'warn', ms: 3600 });
        return;
      }
      el.dataset.recording = '1';
      card?.classList.add('is-recording');
      haptic([18, 40, 18]);

      // The same button stops it, so there is one control and no way to end up
      // with a recording running behind a screen you have navigated away from.
      const stopOnce = async () => {
        el.removeEventListener('click', stopOnce, true);
        const blob = await handle.stop();
        card?.classList.remove('is-recording');
        if (blob && blob.size > 1200) {
          await saveClip(blob);
          mutate((s) => { s.profile.hasVoice = true; });
          toast('Saved. It plays on the SOS screen.', { tone: 'good' });
        } else {
          toast('That was too short to keep.', { tone: 'warn' });
        }
        refresh();
      };
      el.addEventListener('click', stopOnce, true);
    },

    playown: () => { haptic(8); playClip(); },

    delvoice: async () => {
      const ok = await confirmSheet({
        title: 'Delete the recording?',
        message: 'It is gone for good, and the SOS screen goes back to the written lines only.',
        confirmLabel: 'Delete', tone: 'danger',
      });
      if (!ok) return;
      await deleteClip();
      mutate((s) => { s.profile.hasVoice = false; });
      toast('Recording deleted');
      refresh();
    },

    export: () => {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sabr-backup-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Backup downloaded', { tone: 'good' });
    },

    import: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const ok = await confirmSheet({
          title: 'Replace everything?',
          message: `Importing "${file.name}" overwrites all current data on this device. Export a backup first if you are not sure.`,
          confirmLabel: 'Import and replace', tone: 'danger',
        });
        if (!ok) return;
        try {
          importJSON(await file.text());
          toast('Backup restored', { tone: 'good' });
          go('today');
        } catch (err) {
          toast(err.message || 'That file could not be read', { tone: 'warn' });
        }
      });
      input.click();
    },

    reset: async () => {
      const ok = await confirmSheet({
        title: 'Erase everything?',
        message: 'Every habit, log, streak, quest and Shield record on this device is deleted permanently. This cannot be undone and there is no copy anywhere else.',
        confirmLabel: 'Erase it all', tone: 'danger',
      });
      if (!ok) return;
      const sure = await confirmSheet({
        title: 'Really sure?',
        message: 'Last check. Export a backup instead if there is any doubt.',
        confirmLabel: 'Yes, erase', tone: 'danger',
      });
      if (!sure) return;
      replaceState(defaultState());
      go('today');
      location.reload();
    },
  });
}
