// reps.js — the indoor training screen.
//
// One round, five ladders, and a graph that answers the only question worth
// asking: is this actually working?
//
// The whole screen is built so that a missed day is a non-event. There is no
// chain to break, no red, no "you were on 12 days". What it counts instead is
// the total — days trained, points banked, how far up each ladder you now
// stand — and every one of those numbers survives a fortnight on the sofa
// untouched. See the rules at the top of core/training.js.

import { h, raw, actions, haptic, toast, xpBurst, sheet, bar, qaRow, confirmSheet } from '../ui/dom.js';
import { getState } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { refresh, go } from '../core/router.js';
import { sfx } from '../core/audio.js';
import { confetti } from '../ui/confetti.js';
import { evidenceCard } from '../ui/widgets.js';
import { prettyDay, todayKey } from '../core/dates.js';
import { MOVEMENTS, MOVEMENT_ORDER, ROUTINES, UNIT, GEAR, rung, describeSet, gearFor, defaultRungFor } from '../data/exercises.js';
import {
  plan, hasPlan, goalRounds, setGoalRounds, applyRoutine, setPlan, setRung, removeMovement, spareMovements,
  dayLog, setsToday, logSet, undoLastSet, roundsDone, dayScore, history, trainedDays, bestDay,
  lifetimeScore, stamina, bestSet, ladderPositions, stepUpReady, stepUp, stepDown, declineStepUp,
  planLine, roundWord, onlyMovement, restSeconds, setRestSeconds, REST_CHOICES, TRAIN_XP,
} from '../core/training.js';

/* ------------------------------------------------------------------ bits */

/** One set of dots per set logged today. Past six it becomes a number, because
 *  eleven dots in a row stops being readable and starts being wallpaper. */
function pips(n, target) {
  if (n > 6) return raw(h`<span class="trpips__n">×${n}</span>`);
  const out = [];
  for (let i = 0; i < Math.max(target, n); i++) {
    out.push(`<i class="trpip${i < n ? ' is-on' : ''}"></i>`);
  }
  return raw(out.join(''));
}

function unitWord(r, n) {
  return r.unit === UNIT.SEC ? `${n} sec` : `${n}`;
}

/* ------------------------------------------------------------ rest timer */

/**
 * The clock between sets.
 *
 * It lives on document.body rather than inside the screen, for two reasons.
 * Logging a set re-renders the whole screen, and a timer that is torn down and
 * rebuilt every time you use it is not a timer. And rest does not stop because
 * you wandered off to Today — the bar follows you and keeps counting.
 *
 * It never blocks anything. The next set can be logged while it is still
 * running, and the timer is a suggestion with a skip button, not a gate.
 */
let rest = { el: null, endsAt: 0, total: 0, tick: null };

function stopRest() {
  if (rest.tick) clearInterval(rest.tick);
  rest.el?.remove();
  rest = { el: null, endsAt: 0, total: 0, tick: null };
}

function mmss(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function startRest(seconds) {
  if (!seconds) return;
  stopRest();

  const el = document.createElement('div');
  el.className = 'restbar';
  el.innerHTML = `
    <i class="restbar__fill"></i>
    <div class="restbar__body">
      <span class="restbar__k">Rest</span>
      <span class="restbar__t mono">${mmss(seconds)}</span>
      <button class="restbar__b" data-rest-add>+20s</button>
      <button class="restbar__b restbar__b--go" data-rest-skip>Skip</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));

  el.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-rest-add]')) {
      rest.endsAt += 20000;
      rest.total += 20;
      haptic(8);
      paint();
      return;
    }
    if (ev.target.closest('[data-rest-skip]')) { haptic(8); stopRest(); }
  });

  rest.el = el;
  rest.total = seconds;
  rest.endsAt = Date.now() + seconds * 1000;

  function paint() {
    const left = (rest.endsAt - Date.now()) / 1000;
    if (left <= 0) { finish(); return; }
    el.querySelector('.restbar__t').textContent = mmss(left);
    el.querySelector('.restbar__fill').style.width = `${Math.max(0, (left / rest.total) * 100).toFixed(1)}%`;
  }

  function finish() {
    if (rest.tick) clearInterval(rest.tick);
    rest.tick = null;
    el.classList.add('is-done');
    el.querySelector('.restbar__k').textContent = 'Rest over';
    el.querySelector('.restbar__t').textContent = 'Next set';
    el.querySelector('.restbar__fill').style.width = '100%';
    el.querySelector('[data-rest-add]')?.remove();
    el.querySelector('[data-rest-skip]').textContent = 'Done';
    sfx('begin');
    haptic([30, 60, 30]);
    // Long enough to be seen from across the room, short enough not to become
    // furniture. Tapping Done clears it sooner.
    setTimeout(() => { if (rest.el === el) stopRest(); }, 8000);
  }

  sfx('rest');
  paint();
  rest.tick = setInterval(paint, 250);
}

/** Start the rest clock after a set, unless the user has switched it off. */
function restAfterSet() {
  const secs = restSeconds();
  if (secs) startRest(secs);
}

/* ---------------------------------------------------------------- screen */

export const repsScreen = {
  render() {
    const state = getState();
    if (!hasPlan(state)) return chooseView();

    const key = todayKey();
    const items = plan(state);
    const done = roundsDone(state, key);
    const goal = goalRounds(state);
    const today = dayScore(state, key);
    const stam = stamina(state);
    const ready = items.map((p) => stepUpReady(state, p.mid)).filter(Boolean);
    const gear = gearFor(items);
    // A round of one movement is a set. Calling it a round would be the app
    // using its own jargon at somebody who asked for push-ups and nothing else.
    const solo = items.length === 1;

    return h`
      <div class="screen">
        <header class="screen__head screen__head--tight">
          <div class="row-between" style="margin-bottom:2px">
            <div class="eyebrow">Reps</div>
            <button class="backbtn" data-act="back">‹ Back</button>
          </div>
          <div class="row-between">
            <h1 style="margin:0">Your round</h1>
            <button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>
          </div>
        </header>

        <div class="stack">
          ${raw(roundCard(done, goal, today, stam, solo))}

          <div>
            ${items.map((p) => raw(moveRow(state, p, key)))}
          </div>

          ${solo ? raw('') : raw(h`
            <button class="btn btn--primary btn--lg btn--block" data-act="logall" style="min-height:60px">
              ${icon('check')} Log a full round
            </button>`)}
          <p class="muted center" style="font-size:.78rem;margin:${solo ? '0' : '-4px 0 0'}">
            Tap the number beside ${solo ? 'it' : 'one'} as you finish ${solo ? 'a set' : 'it'}. Under the target still counts —
            open ${solo ? 'the' : 'a'} row to type what you actually did.
          </p>

          ${gear.length ? raw(h`
            <p class="trgearline">${icon('box', { size: 14 })} Needs ${gear.join(' · ').toLowerCase()}</p>`) : raw('')}

          ${ready.length ? raw(ready.map((r) => stepUpCard(r)).join('')) : raw('')}

          <div class="section-title"><span>Is it working</span></div>
          ${raw(progressCard(state, stam))}
          ${raw(chartCard(state))}

          <div class="section-title"><span>Where you stand</span></div>
          ${raw(ladderCard(state))}

          <details class="more">
            <summary><span>Why there is no streak here</span><i class="more__count">2</i></summary>
            <div class="stack" style="margin-top:12px">
              <div class="card card--accent" style="padding:12px 14px">
                ${raw(qaRow('Missing a day does nothing here',
                  'There is no streak on this screen and nothing to break. Strength does not fall off in a day, and the thing that actually stops people training is not the day off — it is the app that greets them on the way back with a broken counter. Everything counted here only ever goes up: days trained, points banked, how far up each ladder you stand. Take a week off and come back to exactly the numbers you left.'))}
              </div>
              ${raw(evidenceCard('exerciseMood', { full: true }))}
            </div>
          </details>
        </div>
      </div>`;
  },

  mount(root) {
    actions(root, {
      log:     (el, ds) => doLog(ds.mid, null, el),
      logall:  (el) => doLogRound(el),
      undo:    (el, ds) => {
        const removed = undoLastSet(ds.mid);
        if (removed) { haptic(10); toast('Set removed', {}); }
        refresh();
      },
      detail:  (el, ds) => openMovement(ds.mid),
      stepup:  (el, ds) => {
        const to = stepUp(ds.mid);
        if (!to) return;
        sfx('claim');
        haptic([16, 44, 22]);
        confetti({ count: 60 });
        toast(`Moved up to ${to.label}`, { icon: icon('trend'), tone: 'good', ms: 3000 });
        refresh();
      },
      notyet:  (el, ds) => { declineStepUp(ds.mid); haptic(8); toast('Staying where you are. It will offer again when you move.', {}); refresh(); },
      edit:    () => openEditor(),
      // Reps is reachable from Today, from Me and from the wallet's free list,
      // so a fixed "‹ Today" was only right for one of the three. Go back where
      // you came from, and fall back to Today when there is nowhere to go.
      // `window.` is not decoration: this module imports a `history` of its own
      // from core/training.js, and the bare name resolves to that one.
      back:    () => { if (window.history.length > 1) window.history.back(); else go('today'); },
      pick:    (el, ds) => {
        const r = applyRoutine(ds.id);
        if (!r) return;
        sfx('tiny');
        haptic([14, 34, 18]);
        toast(`${r.label} — ${planLine()}`, { tone: 'good', ms: 3200 });
        refresh();
      },
      build:   () => openEditor(),
      only:    (el, ds) => {
        const r = onlyMovement(ds.mid);
        if (!r) return;
        sfx('tiny');
        haptic([14, 34, 18]);
        refresh();
        // Straight into the ladder: somebody who asked for one movement is
        // exactly the person who cares which version of it they are doing.
        openMovement(ds.mid);
      },
    });
  },
};

/* ------------------------------------------------------------ the header */

function roundCard(done, goal, today, stam, solo = false) {
  const word = solo ? 'set' : 'round';
  const pct = goal ? Math.min(1, done / goal) : 0;
  const line = done === 0
    ? 'Nothing logged yet today. One set is a start.'
    : done >= goal
      ? (done > goal ? `${done} ${word}s — past what you set out to do.`
                     : `${word === 'set' ? 'Set' : 'Round'} done. Anything more is a bonus.`)
      : `${goal - done} more to reach the ${goal} you set.`;

  return h`
    <div class="card trhead">
      <div class="row-between">
        <div>
          <div class="trhead__n">${done}<span class="trhead__of"> / ${goal}</span></div>
          <div class="trhead__l">${word}${goal === 1 ? '' : 's'} today</div>
        </div>
        <div class="trhead__pts">
          <div class="trhead__ptsn">${today}</div>
          <div class="trhead__ptsl">points</div>
        </div>
      </div>
      <div style="margin-top:11px">${bar(pct, { color: 'var(--orange)', height: 12 })}</div>
      <div class="trhead__foot">${line}</div>
      ${stam.delta != null ? raw(h`
        <div class="trtrend trtrend--${stam.delta >= 0 ? 'up' : 'flat'}">
          ${icon('trend', { size: 15 })}
          <span class="grow">${stam.delta >= 0
            ? `Up ${stam.delta}% on last week`
            : `${Math.abs(stam.delta)}% under last week — still counted`}</span>
        </div>`) : raw('')}
    </div>`;
}

/* -------------------------------------------------------- movement rows */

function moveRow(state, p, key) {
  const m = MOVEMENTS[p.mid];
  const r = rung(p.mid, p.rung);
  const sets = setsToday(state, p.mid, key);
  const goal = goalRounds(state);
  const best = bestSet(state, p.mid, p.rung);
  // Only sets on the rung you are standing on now: after a step-up mid-day,
  // adding yesterday's easier reps into today's total would label them with
  // a rung that did not do them.
  const totalToday = sets.filter((x) => x.rung === p.rung).reduce((sum, x) => sum + (Number(x.reps) || 0), 0);

  return h`
    <div class="trmove${sets.length ? ' is-done' : ''}">
      <button class="trmove__body" data-act="detail" data-mid="${p.mid}">
        <span class="trmove__e">${m.emoji}</span>
        <span class="grow">
          <span class="trmove__t">${r.label}</span>
          <span class="trmove__s">${describeSet(r)} · ${m.label}${best ? ` · best ${unitWord(r, best)}` : ''}</span>
          <span class="trpips">${pips(sets.length, goal)}${totalToday ? raw(h`<span class="trpips__tot">${unitWord(r, totalToday)} today</span>`) : raw('')}</span>
        </span>
      </button>
      ${sets.length ? raw(h`<button class="trmove__undo" data-act="undo" data-mid="${p.mid}" aria-label="Remove last set">${icon('minus', { size: 15 })}</button>`) : raw('')}
      <button class="trmove__log" data-act="log" data-mid="${p.mid}" aria-label="Log a set of ${r.label}">
        <span class="trmove__logn">${r.target}</span>
        <span class="trmove__logu">${r.unit === UNIT.SEC ? 'sec' : 'reps'}</span>
      </button>
    </div>`;
}

/* ------------------------------------------------------------- progress */

function progressCard(state, stam) {
  const best = bestDay(state);
  return h`
    <div class="statgrid">
      <div class="stat"><div class="stat__n">${trainedDays(state)}</div><div class="stat__l">days trained</div></div>
      <div class="stat"><div class="stat__n">${stam.week}</div><div class="stat__l">points this week</div></div>
      <div class="stat"><div class="stat__n">${best.score}</div><div class="stat__l">best day</div></div>
    </div>
    <div class="statgrid" style="margin-top:9px">
      <div class="stat"><div class="stat__n">${lifetimeScore(state).toLocaleString()}</div><div class="stat__l">points ever</div></div>
      <div class="stat"><div class="stat__n">${stam.avg}</div><div class="stat__l">daily average</div></div>
      <div class="stat"><div class="stat__n">${dayLog(state).paid}<span style="font-size:.7em"> / ${TRAIN_XP.dayCap}</span></div><div class="stat__l">XP today</div></div>
    </div>`;
}

/**
 * Three weeks of work, one bar a day.
 *
 * Days with nothing on them are drawn as a flat tick rather than left blank.
 * A gap you can see is honest; a gap that looks like damage is not, and this
 * chart is the one place the temptation to punish a rest day is strongest.
 */
function chartCard(state) {
  const days = history(state, 21);
  const max = Math.max(20, ...days.map((d) => d.score));
  const today = todayKey();
  return h`
    <div class="card">
      <div class="card__title">${icon('chart', { size: 17 })} The last three weeks</div>
      <div class="trbars">
        ${days.map((d) => raw(h`
          <div class="trbar__col${d.key === today ? ' is-now' : ''}${d.score ? '' : ' is-rest'}" title="${prettyDay(d.key)} · ${d.score} points">
            <i class="trbar" style="height:${d.score ? Math.max(6, Math.round((d.score / max) * 100)) : 2}%"></i>
          </div>`))}
      </div>
      <div class="rhythm__foot">
        <span>${prettyDay(days[0].key)}</span>
        <span>${days.filter((d) => d.score).length} of 21 days</span>
        <span>Today</span>
      </div>
    </div>`;
}

/** Every ladder you are on, and how far up it you have climbed. */
function ladderCard(state) {
  const rows = ladderPositions(state);
  return rows.map((row) => h`
    <div class="card trladder">
      <button class="trladder__head" data-act="detail" data-mid="${row.mid}">
        <span class="trmove__e">${row.movement.emoji}</span>
        <span class="grow">
          <span class="trmove__t">${row.movement.label} · ${row.rung.label}</span>
          <span class="trmove__s">Rung ${row.index + 1} of ${row.total}${row.best ? ` · best set ${unitWord(row.rung, row.best)}` : ' · nothing logged yet'}</span>
        </span>
        <span class="listrow__chev">›</span>
      </button>
      <div class="trrungs">
        ${row.movement.rungs.map((r, i) => raw(h`
          <i class="trrung${i < row.index ? ' is-past' : ''}${i === row.index ? ' is-here' : ''}"
             title="${r.label}"></i>`))}
      </div>
      <div class="trladder__foot">
        ${row.ready
          ? h`Ready for ${row.ready.to.label} — you have hit the target on ${row.ready.hits} days.`
          : row.index >= row.total - 1
            ? 'Top of this ladder. Add reps instead of rungs.'
            : `Hit ${describeSet(row.rung)} in one set on ${3 - Math.min(3, row.hits)} more day${3 - Math.min(3, row.hits) === 1 ? '' : 's'} and it will offer ${row.movement.rungs[row.index + 1].label}.`}
      </div>
    </div>`).join('');
}

function stepUpCard(r) {
  return h`
    <div class="card card--warn trstep">
      <div class="card__title">${icon('trend', { size: 17 })} Ready to move up</div>
      <p class="prose" style="margin:0 0 12px">
        You have hit ${describeSet(r.from)} of <strong>${r.from.label}</strong> on ${r.hits} separate days.
        The next rung is <strong>${r.to.label}</strong> — ${describeSet(r.to)}.
      </p>
      <div class="row" style="gap:8px">
        <button class="btn btn--primary grow" data-act="stepup" data-mid="${r.mid}">Move up</button>
        <button class="btn btn--ghost" data-act="notyet" data-mid="${r.mid}">Not yet</button>
      </div>
    </div>`;
}

/* ---------------------------------------------------------- first choice */

function chooseView() {
  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="row-between" style="margin-bottom:2px">
          <div class="eyebrow">Reps</div>
          <button class="backbtn" data-act="back">‹ Back</button>
        </div>
        <h1>Pick a round</h1>
        <p class="muted" style="margin-top:6px;font-size:.9rem;line-height:1.5">
          A round is one set of each exercise. Do it once, or three times, or half of it — everything is counted and
          nothing is ever taken away for a day you miss.
        </p>
      </header>

      <div class="stack">
        ${ROUTINES.map((r) => raw(h`
          <button class="listrow trroutine" data-act="pick" data-id="${r.id}">
            <span class="grow">
              <span class="trroutine__t">${r.label}</span>
              <span class="trroutine__s">${r.sub}</span>
              <span class="trroutine__b">${r.blurb}</span>
              <span class="trroutine__g">${gearFor(r.plan.map(([mid, rid]) => ({ mid, rung: rid }))).join(' · ') || 'No equipment'}</span>
            </span>
            <span class="listrow__chev">›</span>
          </button>`))}

        <div class="section-title"><span>Or just one thing</span></div>
        <p class="muted" style="font-size:.82rem;margin:-4px 0 2px;line-height:1.5">
          Only push-ups. Only squats. A round of one movement is a perfectly good round, and you can add a second
          pattern the day you want one.
        </p>
        <div class="tronly">
          ${MOVEMENT_ORDER.map((mid) => {
            const m = MOVEMENTS[mid];
            const d = defaultRungFor(mid);
            return raw(h`
              <button class="tronlybtn" data-act="only" data-mid="${mid}">
                <span class="tronlybtn__e">${m.emoji}</span>
                <span class="tronlybtn__t">${m.label}</span>
                <span class="tronlybtn__s">${d.short || d.label.toLowerCase()}</span>
              </button>`);
          })}
        </div>

        <button class="btn btn--ghost btn--block" data-act="build">Build my own</button>

        <div class="card" style="padding:12px 14px">
          ${raw(qaRow('Cannot do a single pull-up?',
            'Then you are two rungs down that ladder, not failing it. Every movement here has six versions from something you can do against a wall today up to something that takes months, and the app moves you up only when you have cleared the one you are on three times. Pick the easiest thing that still feels like work.'))}
        </div>

        ${raw(evidenceCard('exerciseMood', { full: true }))}
      </div>
    </div>`;
}

/* --------------------------------------------------------------- logging */

function doLog(mid, reps, el) {
  const word = roundWord();
  const res = logSet(mid, reps);
  if (!res) return;
  haptic([12, 30, 16]);
  sfx('tiny');
  if (res.xp) xpBurst(res.xp, el, 'var(--orange)');
  if (res.roundFinished) {
    sfx('claim');
    haptic([18, 50, 22, 50, 30]);
    confetti({ count: 70 });
    toast(`${word === 'set' ? 'Set' : 'Round'} ${res.rounds} done`, { icon: icon('jasad'), tone: 'good', ms: 2600 });
  } else if (res.capped) {
    toast('Counted. XP is capped for today — the work still is not.', {});
  }
  refresh();
  restAfterSet();
}

/** One set of everything still owed in the current round. */
function doLogRound(el) {
  const state = getState();
  const key = todayKey();
  const done = roundsDone(state, key);
  const owed = plan(state).filter((p) => setsToday(state, p.mid, key).length <= done);
  if (!owed.length) return;

  let xp = 0;
  let rounds = done;
  for (const p of owed) {
    const res = logSet(p.mid);
    if (res) { xp += res.xp; rounds = res.rounds; }
  }
  haptic([18, 50, 22, 50, 30]);
  sfx('claim');
  confetti({ count: 80 });
  if (xp) xpBurst(xp, el, 'var(--orange)');
  toast(`${roundWord(state) === 'set' ? 'Set' : 'Round'} ${rounds} done`, { icon: icon('jasad'), tone: 'good', ms: 2600 });
  refresh();
  // The rest here is the one before the next time through, so it only earns a
  // clock when there is a next time through to rest for.
  if (rounds < goalRounds(getState())) restAfterSet();
}

/* ---------------------------------------------------------------- sheets */

/** One movement: what it is, how to do it, and the whole ladder it sits on. */
function openMovement(mid) {
  const state = getState();
  const item = plan(state).find((p) => p.mid === mid);
  if (!item) return;
  const m = MOVEMENTS[mid];
  const here = rung(mid, item.rung);

  sheet({
    title: m.label,
    size: 'full',
    body: h`
      <div class="stack">
        <div class="card">
          <div class="card__title">${m.emoji} ${here.label}</div>
          <p class="prose" style="margin:0">${here.cue}</p>
          <div class="trgear">${icon('box', { size: 14 })} ${GEAR[here.gear]?.label || 'Nothing'}</div>
        </div>

        <div class="row" style="gap:8px">
          <button class="btn btn--primary grow" data-log="1">Log ${describeSet(here)}</button>
          <button class="btn btn--ghost" data-custom="1">Other number</button>
        </div>

        <div class="section-title" style="margin-top:10px"><span>The ladder</span></div>
        <p class="muted" style="font-size:.8rem;margin:-4px 0 4px;line-height:1.5">
          Pick any rung you like. Going down is a free move and the app will never argue with it.
        </p>
        ${m.rungs.map((r, i) => raw(h`
          <button class="trpick${r.id === here.id ? ' is-here' : ''}" data-rung="${r.id}">
            <span class="trpick__i">${i + 1}</span>
            <span class="grow">
              <span class="trpick__t">${r.label}</span>
              <span class="trpick__s">${describeSet(r)} · ${GEAR[r.gear]?.label || 'Nothing'} · ${r.pts} pts</span>
              <span class="trpick__c">${r.cue}</span>
            </span>
            ${bestSet(state, mid, r.id) ? raw(h`<span class="trpick__b">best ${unitWord(r, bestSet(state, mid, r.id))}</span>`) : raw('')}
          </button>`))}

        ${plan(state).length > 1 ? raw(h`
          <button class="btn btn--ghost btn--block" data-remove="1" style="margin-top:14px">Take ${m.label} out of the round</button>`)
          : raw(h`
          <p class="muted center" style="font-size:.78rem;margin-top:14px">
            This is the whole round. Add another pattern from Edit if you want one — nothing says a round has to be
            more than one movement.
          </p>`)}
      </div>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const pick = ev.target.closest('[data-rung]');
        if (pick) {
          setRung(mid, pick.dataset.rung);
          haptic(10);
          close();
          refresh();
          return;
        }
        if (ev.target.closest('[data-log]')) { close(); doLog(mid, null, null); return; }
        if (ev.target.closest('[data-custom]')) { close(); openCustom(mid); return; }
        if (ev.target.closest('[data-remove]')) {
          removeMovement(mid);
          haptic(10);
          close();
          refresh();
        }
      });
    },
  });
}

/** Type what you actually did. The point of the app is the honest number. */
function openCustom(mid) {
  const item = plan().find((p) => p.mid === mid);
  if (!item) return;
  const r = rung(mid, item.rung);
  const isSec = r.unit === UNIT.SEC;

  sheet({
    title: r.label,
    body: h`
      <div class="stack">
        <label class="field">
          <span>How many did you actually do?</span>
          <input type="number" id="tr-n" inputmode="numeric" min="1" max="999" value="${r.target}">
          <span class="hint">${isSec ? 'Seconds held.' : 'Reps in this set.'} Under the target counts, over it counts more — there is no wrong number here except a made-up one.</span>
        </label>
        <div class="chiprow">
          ${[Math.max(1, Math.round(r.target / 2)), r.target, Math.round(r.target * 1.5), r.target * 2]
            .filter((n, i, a) => a.indexOf(n) === i)
            .map((n) => raw(h`<button class="chip" data-quick="${n}">${isSec ? `${n}s` : n}</button>`))}
        </div>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Log it</button>`,
    onMount: (el, close) => {
      const input = el.querySelector('#tr-n');
      setTimeout(() => input.select?.(), 250);
      const save = () => {
        const n = Math.max(1, Math.min(999, Math.round(Number(input.value) || 0)));
        close();
        doLog(mid, n, null);
      };
      el.addEventListener('click', (ev) => {
        const q = ev.target.closest('[data-quick]');
        if (q) { input.value = q.dataset.quick; return; }
        if (ev.target.closest('[data-save]')) save();
      });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
    },
  });
}

/** The round itself: which movements, how many times through, start over. */
function openEditor() {
  const state = getState();
  const items = plan(state);
  const spare = spareMovements(state);
  const goal = goalRounds(state);
  const restNow = restSeconds(state);
  const word = roundWord(state);

  sheet({
    title: 'Your round',
    size: 'full',
    body: h`
      <div class="stack">
        <label class="field">
          <span>How many ${word}s are you aiming for?</span>
          <div class="chiprow" id="tr-goal">
            ${[1, 2, 3, 5].map((n) => raw(h`<button class="chip${n === goal ? ' is-on' : ''}" data-goal="${n}">${n}</button>`))}
          </div>
          <span class="hint">A target to aim at, never a requirement. Half a ${word} is still logged, still scored, and still shows up on the graph.</span>
        </label>

        <label class="field">
          <span>Rest between sets</span>
          <div class="chiprow" id="tr-rest">
            ${REST_CHOICES.map((n) => raw(h`
              <button class="chip${n === restNow ? ' is-on' : ''}" data-rest="${n}">${n === 0 ? 'Off' : n >= 60 ? `${n / 60}m` : `${n}s`}</button>`))}
          </div>
          <span class="hint">A clock that starts when you log a set, so the gap between sets is a rest rather than however long the phone takes. It never blocks anything — the next set can be logged while it is still running, and Skip ends it.</span>
        </label>

        <div class="section-title"><span>In the round</span></div>
        ${items.length ? items.map((p) => {
          const m = MOVEMENTS[p.mid];
          const r = rung(p.mid, p.rung);
          return raw(h`
            <div class="trmove" style="margin-bottom:10px">
              <button class="trmove__body" data-open="${p.mid}">
                <span class="trmove__e">${m.emoji}</span>
                <span class="grow">
                  <span class="trmove__t">${r.label}</span>
                  <span class="trmove__s">${m.label} · ${describeSet(r)}</span>
                </span>
              </button>
              <div class="trmove__steps">
                <button class="trstepbtn" data-down="${p.mid}" aria-label="Easier">${icon('minus', { size: 14 })}</button>
                <button class="trstepbtn" data-up="${p.mid}" aria-label="Harder">+</button>
                <button class="trstepbtn trstepbtn--del" data-del="${p.mid}" aria-label="Remove ${m.label}">${icon('close', { size: 13 })}</button>
              </div>
            </div>`);
        }) : raw(h`<p class="muted">Nothing in the round yet.</p>`)}

        ${spare.length ? raw(h`
          <div class="section-title"><span>Add a pattern</span></div>
          ${spare.map((m) => raw(h`
            <button class="listrow" data-add="${m.id}" style="width:100%;text-align:left;margin-bottom:10px">
              <span class="listrow__icon">${m.emoji}</span>
              <span class="grow">
                <span style="display:block;font-weight:700">${m.label}</span>
                <span class="muted" style="font-size:.78rem">${m.what}</span>
              </span>
              <span class="listrow__chev">+</span>
            </button>`))}`) : raw('')}

        <div class="section-title"><span>Start again</span></div>
        ${ROUTINES.map((r) => raw(h`
          <button class="listrow trroutine" data-routine="${r.id}" style="margin-bottom:10px">
            <span class="grow">
              <span class="trroutine__t">${r.label}</span>
              <span class="trroutine__s">${r.sub}</span>
            </span>
            <span class="listrow__chev">›</span>
          </button>`))}

        <button class="btn btn--ghost btn--block" data-clear="1" style="margin-top:10px">Clear the round</button>
        <p class="muted" style="font-size:.78rem;line-height:1.5">
          Clearing only empties the round. Every set you have ever logged stays exactly where it is.
        </p>
      </div>`,
    onMount: (el, close) => {
      el.addEventListener('click', async (ev) => {
        const g = ev.target.closest('[data-goal]');
        if (g) {
          setGoalRounds(Number(g.dataset.goal));
          el.querySelectorAll('[data-goal]').forEach((b) => b.classList.toggle('is-on', b === g));
          haptic(8);
          return;
        }
        const rs = ev.target.closest('[data-rest]');
        if (rs) {
          setRestSeconds(Number(rs.dataset.rest));
          el.querySelectorAll('[data-rest]').forEach((b) => b.classList.toggle('is-on', b === rs));
          haptic(8);
          if (!Number(rs.dataset.rest)) stopRest();
          return;
        }
        const del = ev.target.closest('[data-del]');
        if (del) {
          if (plan().length <= 1) {
            toast('A round needs at least one movement. Swap it instead, or clear the round below.', {});
            return;
          }
          removeMovement(del.dataset.del);
          haptic(10);
          close();
          refresh();
          return;
        }
        const up = ev.target.closest('[data-up]');
        if (up) { stepUp(up.dataset.up); haptic(8); repaintRow(el, up.dataset.up); refresh(); return; }
        const down = ev.target.closest('[data-down]');
        if (down) { stepDown(down.dataset.down); haptic(8); repaintRow(el, down.dataset.down); refresh(); return; }
        const open = ev.target.closest('[data-open]');
        if (open) { close(); openMovement(open.dataset.open); return; }
        const add = ev.target.closest('[data-add]');
        if (add) {
          const m = MOVEMENTS[add.dataset.add];
          // Added at the gentlest rung on purpose. Being handed something too
          // hard on day one is how a round stops getting opened.
          setRung(m.id, m.rungs[0].id);
          haptic(10);
          toast(`${m.label} added — ${m.rungs[0].label}`, { tone: 'good' });
          close();
          refresh();
          return;
        }
        const rt = ev.target.closest('[data-routine]');
        if (rt) { applyRoutine(rt.dataset.routine); haptic([14, 34, 18]); close(); refresh(); return; }
        if (ev.target.closest('[data-clear]')) {
          close();
          const ok = await confirmSheet({
            title: 'Clear the round?',
            message: 'The round empties and you pick a new one. Your logged sets, points and records are untouched.',
            confirmLabel: 'Clear it',
          });
          if (ok) { setPlan([]); refresh(); }
        }
      });
    },
  });
}

/** Update one editor row after its rung moved, so the sheet does not have to
 *  be torn down and rebuilt under the finger that just tapped it. */
function repaintRow(el, mid) {
  const item = plan().find((p) => p.mid === mid);
  const row = el.querySelector(`[data-open="${mid}"]`);
  if (!item || !row) return;
  const r = rung(mid, item.rung);
  const t = row.querySelector('.trmove__t');
  const sub = row.querySelector('.trmove__s');
  if (t) t.textContent = r.label;
  if (sub) sub.textContent = `${MOVEMENTS[mid].label} · ${describeSet(r)}`;
}

/* ------------------------------------------------------------------ Today */

/**
 * The compact version for the Today screen: what today's round is, how much of
 * it is done, and one tap to the rest. Returns '' when no round is set, so
 * Today can simply drop it in.
 */
export function repsToday(state = getState()) {
  // No round yet is still worth a row. This used to return '' and the only way
  // in was a link inside Today's collapsed "More today" list — two taps and a
  // disclosure to reach a free feature, which is two taps more than the thing
  // is worth. The card is the way in either way now.
  if (!hasPlan(state)) {
    return h`
      <button class="card trtoday trtoday--new" data-act="reps" style="width:100%;text-align:left">
        <span class="row-between">
          <span class="grow">
            <span class="trtoday__k">${icon('jasad', { size: 15 })} Reps</span>
            <span class="trtoday__t">Train indoors, from wherever you are now</span>
            <span class="trtoday__s">Five movements, six versions of each. Picking a round takes about a minute.</span>
          </span>
          <span class="listrow__chev">›</span>
        </span>
      </button>`;
  }
  const key = todayKey();
  const done = roundsDone(state, key);
  const goal = goalRounds(state);
  const sets = dayLog(state, key).sets.length;
  const word = roundWord(state);

  return h`
    <button class="card trtoday${sets ? ' is-started' : ''}" data-act="reps" style="width:100%;text-align:left">
      <span class="row-between">
        <span class="grow">
          <span class="trtoday__k">${icon('jasad', { size: 15 })} Reps</span>
          <span class="trtoday__t">${planLine(state)}</span>
          <span class="trtoday__s">${sets === 0
            ? `${goal} ${word}${goal === 1 ? '' : 's'} today · nothing logged yet`
            : `${done} of ${goal} ${word}${goal === 1 ? '' : 's'} · ${dayScore(state, key)} points`}</span>
        </span>
        <span class="listrow__chev">›</span>
      </span>
    </button>`;
}
