// uni.js (screen) — FAST-NUCES academics.
// Routes: #/uni · #/uni/setup · #/uni/new · #/uni/course/<id>

import { h, raw, actions, haptic, toast, sheet, confirmSheet, bar, ring, empty, qaRow, xpBurst } from '../ui/dom.js';
import { getState, mutate } from '../core/store.js';
import {
  ATTEND, addCourse, updateCourse, deleteCourse, courseById, activeCourses,
  classesOn, markAttendance, attendanceFor, attendanceOverview,
  setMark, courseStanding, neededForTarget, gpaOf, cgpaOf, saveSemesterToHistory,
  addTask, toggleTask, deleteTask, upcomingTasks, overdueTasks, TASK_TYPES,
  UNI_XP, logStudy, studyTotals, studyForCourse, weekBonus, claimWeekBonus,
  semesterScore, taskValue,
} from '../core/academics.js';
import { comboMultiplier } from '../core/game.js';
import { sfx } from '../core/audio.js';
import {
  CAMPUSES, PROGRAMS, GRADE_ORDER, GRADE_POINTS, WEIGHT_LABELS, WEIGHT_ORDER,
  COURSE_PRESETS, SEMESTER_NAMES, indicativeGrade,
} from '../data/fast.js';
import { todayKey, prettyDay, prettyTime, parseHM, WEEKDAY_SHORT, daysBetween } from '../core/dates.js';
import { refresh, go } from '../core/router.js';
import { icon } from '../ui/icons.js';

export const uniScreen = {
  render(route) {
    const view = route.params[0];
    if (!getState().academics.enabled && view !== 'setup') return renderIntro();
    if (view === 'setup')  return renderSetup();
    if (view === 'new')    return renderCourseEditor('new');
    if (view === 'course') return renderCourse(route.params[1]);
    return renderDashboard();
  },
  mount(root, route) {
    const view = route.params[0];
    if (!getState().academics.enabled && view !== 'setup') return mountIntro(root);
    if (view === 'setup')  return mountSetup(root);
    if (view === 'new')    return mountCourseEditor(root, 'new');
    if (view === 'course') return mountCourse(root, route.params[1]);
    return mountDashboard(root);
  },
};

/* --------------------------------------------------------------- intro */

function renderIntro() {
  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">Academics</div>
        <h1>FAST-NUCES</h1>
      </header>
      <div class="stack">
        <div class="card">
          <p class="prose">
            Track attendance, marks and deadlines alongside everything else — because a 7:55am class
            is a habit like any other, and short attendance is a habit failure with a transcript attached.
          </p>
          <p class="prose">What it gives you:</p>
          <ul class="prose">
            <li><strong>Classes you may still miss.</strong> Not a percentage to decode — a number.</li>
            <li><strong>Where you actually stand</strong> in each course, weighted by that course's own scheme.</li>
            <li><strong>GPA and CGPA</strong> on the NUCES 4.0 scale.</li>
            <li><strong>Deadlines</strong> that show up on your Today screen with everything else.</li>
          </ul>
        </div>
        <div class="card card--warn">
          <div class="card__title">${icon('alert')} Two numbers you must confirm yourself</div>
          <p class="prose" style="margin:0">
            Assessment weightages are set per course by your instructor, and the exact attendance
            threshold is set by your programme. The app defaults to the usual 80% and a common
            weightage split, but <strong>both are editable and you should check them against your
            course outline and the student handbook.</strong> It will use whatever you tell it.
          </p>
        </div>
        <button class="btn btn--primary btn--lg btn--block" data-act="setup">Set up my semester</button>
      </div>
    </div>`;
}

function mountIntro(root) {
  actions(root, { setup: () => go('uni/setup') });
}

/* --------------------------------------------------------------- setup */

function renderSetup() {
  const a = getState().academics;
  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/uni" class="muted" style="font-size:.85rem">‹ Academics</a>
        <h1 style="margin-top:6px">Semester setup</h1>
      </header>

      <label class="field">
        <span>Campus</span>
        <select id="un-campus">
          <option value="">Select…</option>
          ${CAMPUSES.map((c) => raw(h`<option value="${c}" ${a.campus === c ? 'selected' : ''}>${c}</option>`))}
        </select>
      </label>

      <label class="field">
        <span>Programme</span>
        <select id="un-program">
          <option value="">Select…</option>
          ${PROGRAMS.map((p) => raw(h`<option value="${p}" ${a.program === p ? 'selected' : ''}>${p}</option>`))}
        </select>
      </label>

      <label class="field">
        <span>Roll number (optional)</span>
        <input type="text" id="un-roll" value="${a.rollNumber}" placeholder="21K-1234">
      </label>

      <label class="field">
        <span>Semester</span>
        <input type="text" id="un-semname" value="${a.semester.name}" placeholder="Fall 2026">
        <span class="hint">e.g. ${SEMESTER_NAMES.join(', ')} + year.</span>
      </label>

      <label class="field">
        <span>First day of classes</span>
        <input type="date" id="un-start" value="${a.semester.startDate || ''}">
      </label>

      <label class="field">
        <span>Last day of classes</span>
        <input type="date" id="un-end" value="${a.semester.endDate || ''}">
        <span class="hint">These two dates are what let the app tell you how many classes you may still miss. Without them it can only show a percentage.</span>
      </label>

      <label class="field">
        <span>Minimum attendance required</span>
        <input type="number" id="un-threshold" min="1" max="100" step="1" value="${Math.round((a.attendanceThreshold || 0.8) * 100)}">
        <span class="hint">Percent of classes you must attend to sit the final. Defaults to 80% — confirm yours.</span>
      </label>

      <button class="btn btn--primary btn--lg btn--block" style="margin-top:10px" data-act="save">Save and continue</button>
    </div>`;
}

function mountSetup(root) {
  actions(root, {
    save: () => {
      const val = (id) => root.querySelector(id).value.trim();
      const thr = Number(root.querySelector('#un-threshold').value);
      const start = val('#un-start');
      const end = val('#un-end');
      if (start && end && start >= end) { toast('The last day must come after the first', { tone: 'warn' }); return; }
      mutate((s) => {
        s.academics.enabled = true;
        s.academics.campus = val('#un-campus');
        s.academics.program = val('#un-program');
        s.academics.rollNumber = val('#un-roll');
        s.academics.semester = { name: val('#un-semname'), startDate: start || null, endDate: end || null };
        s.academics.attendanceThreshold = Math.min(1, Math.max(0.01, (thr || 80) / 100));
      });
      haptic([14, 30, 20]);
      toast('Semester saved', { tone: 'good' });
      go('uni');
    },
  });
}

/* ----------------------------------------------------------- dashboard */

function renderDashboard() {
  const state = getState();
  const a = state.academics;
  const key = todayKey();
  const courses = activeCourses(state);
  const today = classesOn(key, state);
  const overview = attendanceOverview(state).filter((r) => r.atRisk || (r.canMiss !== null && r.canMiss <= 2));
  const upcoming = upcomingTasks(state);
  const overdue = overdueTasks(state);
  const { cgpa, semesterGpa } = cgpaOf(state);
  const graded = courses.filter((c) => c.grade).length;
  const bonus = weekBonus(state, key);

  return h`
    <div class="screen">
      <header class="screen__head">
        <div class="eyebrow">${a.semester.name || 'FAST-NUCES'}${a.campus ? ' · ' + a.campus : ''}</div>
        <h1>Academics</h1>
      </header>

      <div class="stack">
        ${bonus.available ? raw(weekBonusCard(bonus)) : raw('')}
        ${raw(studyCard(state))}
        ${raw(scoreCard(state))}

        <div class="statgrid">
          <div class="stat"><div class="stat__n">${semesterGpa != null ? semesterGpa.toFixed(2) : '—'}</div><div class="stat__l">GPA</div></div>
          <div class="stat"><div class="stat__n">${cgpa != null ? cgpa.toFixed(2) : '—'}</div><div class="stat__l">CGPA</div></div>
          <div class="stat"><div class="stat__n">${courses.length}</div><div class="stat__l">courses</div></div>
        </div>
        ${semesterGpa == null && courses.length ? raw(h`
          <p class="muted" style="font-size:.78rem;margin:-4px 0 0;font-weight:600">
            GPA appears once you enter letter grades. ${graded}/${courses.length} entered.
          </p>`) : raw('')}

        ${overview.length ? raw(h`
          <div class="section-title"><span>${icon('alert')} Attendance watch</span></div>
          <div class="stack-sm">
            ${overview.map((r) => raw(attendanceWarning(r)))}
          </div>`) : raw('')}

        <div class="section-title"><span>Today’s classes</span>
          <span class="muted" style="text-transform:none;letter-spacing:0">${prettyDay(key)}</span></div>
        ${today.length
          ? raw(h`<div class="stack-sm">${today.map((c) => raw(classRow(c)))}</div>`)
          : raw(h`<div class="card" style="padding:12px 14px;font-weight:700;font-size:.9rem">No classes today</div>`)}

        ${overdue.length ? raw(h`
          <div class="section-title"><span>${icon('dot')} Overdue</span></div>
          <div class="stack-sm">${overdue.map((t) => raw(taskRow(t, state)))}</div>`) : raw('')}

        <div class="section-title"><span>Deadlines</span>
          <button class="btn btn--ghost btn--sm" data-act="addtask">Add</button></div>
        ${upcoming.length
          ? raw(h`<div class="stack-sm">${upcoming.map((t) => raw(taskRow(t, state)))}</div>`)
          : raw(h`<div class="card" style="padding:12px 14px">
              ${raw(qaRow('Nothing due in three weeks',
                'Only what you have told the app about. Add deadlines from a course to see them here and on Today.'))}
            </div>`)}

        <div class="section-title"><span>Courses</span>
          <button class="btn btn--ghost btn--sm" data-act="newcourse">Add</button></div>
        ${courses.length
          ? raw(h`<div class="stack-sm">${courses.map((c) => raw(courseRow(c, state)))}</div>`)
          : raw(empty({
              icon: icon('books'),
              title: 'No courses yet',
              body: 'Add your courses with their timetable slots, and attendance tracking starts working immediately.',
              actionLabel: 'Add a course',
              action: 'newcourse',
            }))}

        ${a.history.length ? raw(h`
          <div class="section-title"><span>Past semesters</span></div>
          <div class="card stack-sm">
            ${a.history.map((sem) => raw(h`
              <div class="row-between">
                <span style="font-weight:700">${sem.label}</span>
                <span class="mono">${Number(sem.gpa).toFixed(2)} · ${sem.credits} CH</span>
              </div>`))}
          </div>`) : raw('')}

        <div class="section-title"><span>Manage</span></div>
        <div class="stack-sm">
          <div class="listrow" data-act="setup">
            <span class="listrow__icon">${icon('gear')}</span>
            <span class="grow"><span style="display:block;font-weight:700">Semester settings</span>
              <span class="muted" style="font-size:.78rem">Dates, threshold, programme</span></span>
            <span class="listrow__chev">›</span>
          </div>
          <div class="listrow" data-act="closesem">
            <span class="listrow__icon">${icon('cap')}</span>
            <span class="grow"><span style="display:block;font-weight:700">Close the semester</span>
              <span class="muted" style="font-size:.78rem">Bank this GPA into your CGPA and archive the courses</span></span>
            <span class="listrow__chev">›</span>
          </div>
        </div>
      </div>
    </div>`;
}

function attendanceWarning(r) {
  const pct = r.pct != null ? Math.round(r.pct * 100) : 0;
  const critical = r.canMiss === 0 || r.atRisk;
  return h`
    <div class="card ${raw(critical ? 'card--danger' : 'card--warn')}">
      <div class="row-between">
        <div class="grow">
          <div style="font-weight:800">${r.course.code || r.course.title}</div>
          <div class="dim" style="font-size:.85rem;margin-top:3px;font-weight:600">
            ${r.present}/${r.held} attended · ${pct}%
            ${r.canMiss !== null
              ? raw(h` · <strong>${r.canMiss === 0 ? 'no more misses' : `${r.canMiss} more miss${r.canMiss > 1 ? 'es' : ''} left`}</strong>`)
              : raw(' · set semester dates for a miss budget')}
          </div>
        </div>
        <div class="mono" style="font-weight:900;font-size:1.2rem">${pct}%</div>
      </div>
      <div style="margin-top:10px">${bar(r.pct ?? 0, { color: critical ? 'var(--red)' : 'var(--orange)', height: 10 })}</div>
    </div>`;
}

function classRow(c) {
  const s = c.status;
  const label = { present: 'Present', absent: 'Absent', excused: 'Excused', cancelled: 'Cancelled' }[s] || null;
  return h`
    <div class="card" style="${raw(s === ATTEND.PRESENT ? 'border-color:var(--green)' : s === ATTEND.ABSENT ? 'border-color:var(--red)' : '')}">
      <div class="row-between">
        <div class="grow">
          <div style="font-weight:800">${c.course.code || c.course.title}</div>
          <div class="muted" style="font-size:.8rem;margin-top:2px;font-weight:700">
            ${prettyTime(parseHM(c.slot.start) ?? 0)}–${prettyTime(parseHM(c.slot.end) ?? 0)}${c.slot.room ? ' · ' + c.slot.room : ''}
          </div>
        </div>
        ${label ? raw(h`<span class="pill pill--${raw(s === ATTEND.PRESENT ? 'accent' : s === ATTEND.ABSENT ? 'danger' : 'blue')}">${label}</span>`) : raw('')}
      </div>
      <div class="row" style="margin-top:11px;gap:7px">
        <button class="btn ${raw(s === ATTEND.PRESENT ? 'btn--primary' : 'btn--ghost')} btn--sm grow" data-act="att" data-id="${c.course.id}" data-s="present">Present</button>
        <button class="btn ${raw(s === ATTEND.ABSENT ? 'btn--danger' : 'btn--ghost')} btn--sm grow" data-act="att" data-id="${c.course.id}" data-s="absent">Absent</button>
        <button class="btn ${raw(s === ATTEND.CANCELLED ? 'btn--blue' : 'btn--ghost')} btn--sm" data-act="att" data-id="${c.course.id}" data-s="cancelled">Off</button>
      </div>
    </div>`;
}

function taskRow(t, state) {
  const course = courseById(t.courseId, state);
  const days = t.due ? daysBetween(todayKey(), t.due) : null;
  const type = TASK_TYPES.find((x) => x.id === t.type);
  const urgent = days !== null && days <= 2;
  // Priced live, so the number visibly falls as the deadline approaches. That
  // is the entire argument for starting early, made without a sentence of copy.
  const value = taskValue(t);
  return h`
    <div class="task" style="${raw(urgent && !t.done ? 'border-color:var(--red)' : '')}">
      <button class="habitrow__check" data-act="task" data-id="${t.id}" aria-label="Toggle">${icon('check')}</button>
      <div class="grow">
        <div class="task__title">${type ? raw(icon(type.icon, { size: 15 })) : raw('')} ${t.title}</div>
        <div class="muted" style="font-size:.76rem;margin-top:2px;font-weight:700">
          ${course ? (course.code || course.title) + ' · ' : ''}${t.due ? prettyDay(t.due) : 'no date'}${days !== null ? ` · ${days < 0 ? `${-days}d late` : days === 0 ? 'today' : `in ${days}d`}` : ''}
        </div>
      </div>
      ${t.done ? raw('') : raw(h`<span class="pricepill ${value.early ? 'is-early' : ''}"
        title="${value.early ? `${value.base} for the ${type?.label.toLowerCase() || 'task'}, +${value.early} for finishing ${value.daysEarly} days early` : 'What closing this is worth'}"
        >+${value.total}</span>`)}
      <button class="iconbtn" data-act="deltask" data-id="${t.id}" aria-label="Delete">&times;</button>
    </div>`;
}

function courseRow(c, state) {
  const att = attendanceFor(c, state);
  const st = courseStanding(c);
  const pct = att.pct != null ? Math.round(att.pct * 100) : null;
  return h`
    <div class="listrow" data-act="open" data-id="${c.id}">
      <div class="grow">
        <div style="font-weight:800">${c.code || c.title || 'Untitled course'}</div>
        <div class="muted" style="font-size:.79rem;margin-top:2px;font-weight:700">
          ${c.title && c.code ? c.title + ' · ' : ''}${c.creditHours} CH${pct !== null ? ` · ${pct}% attendance` : ''}${st.earnedOfGraded != null ? ` · ${Math.round(st.earnedOfGraded)}% so far` : ''}
        </div>
      </div>
      ${c.grade ? raw(h`<span class="pill pill--gold">${c.grade}</span>`) : raw('')}
      <span class="listrow__chev">›</span>
    </div>`;
}

function mountDashboard(root) {
  actions(root, {
    setup: () => go('uni/setup'),
    newcourse: () => go('uni/new'),
    open: (el, ds) => go(`uni/course/${ds.id}`),
    att: (el, ds) => {
      markAttendance(ds.id, todayKey(), ds.s);
      haptic(12);
      refresh();
    },
    study: () => openStudySheet(),
    claimweek: (el) => {
      const b = claimWeekBonus();
      if (!b) return;
      sfx('claim');
      haptic([14, 40, 20]);
      xpBurst(b.xp, el, 'var(--gold)');
      toast(`A clean week · +${b.xp} XP`, { icon: icon('trophy'), tone: 'good' });
      refresh();
    },
    task: (el, ds) => {
      const t = getState().academics.tasks.find((x) => x.id === ds.id);
      const first = t && !t.done && !t.xp;
      const value = first ? taskValue(t) : null;
      toggleTask(ds.id);
      haptic([12, 30, 16]);
      if (value) {
        sfx('claim');
        xpBurst(value.total, el, 'var(--blue)');
        toast(value.early
          ? `Closed ${value.daysEarly} day${value.daysEarly === 1 ? '' : 's'} early · +${value.total} XP`
          : `Closed · +${value.total} XP`, { tone: 'good' });
      }
      refresh();
    },
    deltask: (el, ds) => { deleteTask(ds.id); refresh(); },
    addtask: () => openTaskSheet(),
    closesem: async () => {
      const { gpa, credits } = gpaOf(activeCourses());
      if (gpa == null) { toast('Enter letter grades first — there is no GPA to bank yet', { tone: 'warn' }); return; }
      const ok = await confirmSheet({
        title: 'Close the semester?',
        message: `This banks a GPA of ${gpa.toFixed(2)} over ${credits} credit hours into your CGPA and archives all current courses. Attendance and marks are kept.`,
        confirmLabel: 'Close semester',
      });
      if (!ok) return;
      saveSemesterToHistory();
      toast('Semester banked', { tone: 'good' });
      refresh();
    },
  });
}

/* ----------------------------------------------------------- the score */

/**
 * The study card.
 *
 * Deliberately the first thing on the screen, above GPA. GPA is an outcome you
 * cannot act on this afternoon; minutes at the desk are the only input you can,
 * and putting the number you control above the number you do not is most of
 * what makes a scoreboard motivating rather than depressing.
 */
function studyCard(state) {
  const t = studyTotals(state);
  const combo = comboMultiplier(t.streak);
  const pct = Math.min(1, t.today / UNI_XP.studyDayCap);

  return h`
    <div class="card studycard">
      <div class="row-between" style="align-items:flex-start">
        <div>
          <div class="studycard__k">Studied today</div>
          <div class="studycard__n">${fmtMins(t.today)}</div>
        </div>
        ${t.streak ? raw(h`
          <div class="studycard__streak">
            ${icon('flame', { size: 16 })} ${t.streak} day${t.streak === 1 ? '' : 's'}
            ${combo > 1 ? raw(h`<em>×${combo.toFixed(2).replace(/0$/, '')} XP</em>`) : raw('')}
          </div>`) : raw('')}
      </div>

      <div class="studycard__bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
      <div class="studycard__cap">
        ${t.atCap
          ? raw(h`Past today’s ${UNI_XP.studyDayCap}-minute ceiling — keep going, it just stops paying.`)
          : raw(h`${fmtMins(t.capLeft)} left that still earns · ${UNI_XP.studyPerMin} XP a minute`)}
      </div>

      <button class="btn btn--primary btn--block" data-act="study" style="margin-top:11px">
        ${icon('books')} Log study
      </button>

      <div class="studycard__row">
        <span>${fmtMins(t.week)} this week</span>
        <span>${t.sessions} session${t.sessions === 1 ? '' : 's'} all semester</span>
      </div>
    </div>`;
}

/** Last week, clean, unclaimed. */
function weekBonusCard(b) {
  return h`
    <div class="card card--gold weekbonus">
      <div class="weekbonus__ico">${icon('trophy', { size: 26 })}</div>
      <div class="grow">
        <div class="weekbonus__t">A week with nothing missed</div>
        <div class="weekbonus__s">${b.present} classes, no absences</div>
      </div>
      <button class="btn btn--gold btn--sm" data-act="claimweek">Claim +${b.xp}</button>
    </div>`;
}

/** What the semester has paid, by source. */
function scoreCard(state) {
  const sc = semesterScore(state);
  return h`
    <details class="card scorecard">
      <summary>
        <span class="grow"><span class="scorecard__k">Earned from university</span></span>
        <span class="scorecard__n">${sc.total.toLocaleString()} XP</span>
        <i class="qa__mark" aria-hidden="true">?</i>
      </summary>
      <div class="scorecard__body">
        ${sc.rows.map((r) => raw(h`
          <div class="scorecard__row">
            <span class="scorecard__ico">${icon(r.icon, { size: 15 })}</span>
            <span class="grow">${r.label}</span>
            <span class="scorecard__c">${r.n}</span>
            <span class="pricepill">${r.xp}</span>
          </div>`))}
        <p class="muted" style="margin:11px 0 0;font-size:.78rem;line-height:1.5;font-weight:600">
          All of it feeds the same level and the same budget as your habits, and
          Aql — the mind attribute — gets every point of it.
        </p>
      </div>
    </details>`;
}

function fmtMins(m) {
  if (!m) return '0m';
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return hrs ? `${hrs}h${rem ? ' ' + rem + 'm' : ''}` : `${rem}m`;
}

/**
 * Logging a block.
 *
 * Presets first, custom second: the point of this sheet is that it takes three
 * seconds, because a study log you have to think about is one you stop keeping
 * by the third week.
 */
function openStudySheet(preselect = null) {
  const state = getState();
  const courses = activeCourses(state);
  const t = studyTotals(state);
  const PRESETS = [15, 25, 45, 60, 90];

  sheet({
    title: 'Log study',
    body: h`
      <div class="stack">
        <p class="prose" style="margin:0">
          Work you did outside class. ${t.today
            ? raw(h`You have logged ${fmtMins(t.today)} today; ${t.atCap
                ? 'anything more is on the house.'
                : `${fmtMins(t.capLeft)} of it still earns.`}`)
            : raw(h`The first ${UNI_XP.studyDayCap} minutes a day earn XP.`)}
        </p>

        ${courses.length ? raw(h`
          <label class="field">
            <span>Course</span>
            <select id="sy-course">
              <option value="">No particular course</option>
              ${courses.map((c) => raw(h`<option value="${c.id}" ${preselect === c.id ? 'selected' : ''}>${c.code || c.title}</option>`))}
            </select>
          </label>`) : raw('')}

        <div class="field">
          <span>How long</span>
          <div class="row wrap" style="gap:8px">
            ${PRESETS.map((m) => raw(h`<button class="chip" data-mins="${m}">${fmtMins(m)}</button>`))}
          </div>
        </div>

        <label class="field">
          <span>Or type the minutes</span>
          <input type="number" id="sy-mins" min="${UNI_XP.studyMinSession}" max="${UNI_XP.studyMaxSession}" placeholder="e.g. 40">
        </label>

        <label class="field">
          <span>What you worked on <em style="font-weight:500;color:var(--muted)">(optional)</em></span>
          <input type="text" id="sy-note" maxlength="120" placeholder="Past papers, chapter 4…">
        </label>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-do="save">Log it</button>`,
    onMount: (el, close) => {
      const minsInput = el.querySelector('#sy-mins');

      el.addEventListener('click', (ev) => {
        const chip = ev.target.closest('[data-mins]');
        if (chip) {
          el.querySelectorAll('[data-mins]').forEach((c) => c.classList.remove('is-on'));
          chip.classList.add('is-on');
          minsInput.value = chip.dataset.mins;
          return;
        }
        if (!ev.target.closest('[data-do="save"]')) return;

        const minutes = Number(minsInput.value);
        if (!minutes || minutes < UNI_XP.studyMinSession) {
          toast(`At least ${UNI_XP.studyMinSession} minutes`, { tone: 'warn' });
          return;
        }
        const res = logStudy({
          courseId: el.querySelector('#sy-course')?.value || null,
          minutes,
          note: el.querySelector('#sy-note').value,
        });
        haptic([12, 30, 16]);
        if (res.xp) {
          sfx('claim');
          toast(res.capped
            ? `+${res.xp} XP · ${fmtMins(res.unpaid)} past today’s ceiling`
            : `${fmtMins(res.minutes)} logged · +${res.xp} XP`, { tone: 'good' });
        } else {
          toast(`${fmtMins(res.minutes)} logged. Past the ceiling, so no XP — it still counts on the record.`);
        }
        close();
        refresh();
      });
    },
  });
}

/** How much work this one course has had out of you. */
function courseStudyCard(courseId, state) {
  const rows = studyForCourse(courseId, state);
  const mins = rows.reduce((n, e) => n + e.minutes, 0);
  const recent = rows.slice(-4).reverse();

  return h`
    <div class="card">
      <div class="row-between">
        <span class="card__title">Study on this course</span>
        <span class="pill ${mins ? 'pill--blue' : ''}">${fmtMins(mins)}</span>
      </div>
      ${recent.length ? raw(h`
        <div style="margin-top:9px">
          ${recent.map((e) => raw(h`
            <div class="row-between studyline">
              <span class="grow">${e.note || 'Study'}</span>
              <span class="muted">${prettyDay(e.day)}</span>
              <span class="pricepill">${fmtMins(e.minutes)}</span>
            </div>`))}
        </div>`)
      : raw(h`<p class="muted" style="margin:8px 0 0;font-size:.82rem;font-weight:600">
          Nothing logged yet. Marks come from the hours, not the timetable.
        </p>`)}
      <button class="btn btn--ghost btn--sm btn--block" data-act="studythis" style="margin-top:10px">
        ${icon('books')} Log study for this course
      </button>
    </div>`;
}

/* ------------------------------------------------------------- course */

function renderCourse(id) {
  const state = getState();
  const c = courseById(id, state);
  if (!c) return h`<div class="screen"><p class="prose">That course no longer exists.</p><a class="btn btn--ghost" href="#/uni">Back</a></div>`;

  const att = attendanceFor(c, state);
  const st = courseStanding(c);
  const need = neededForTarget(c, 80);
  const pct = att.pct != null ? Math.round(att.pct * 100) : 0;

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/uni" class="muted" style="font-size:.85rem">‹ Academics</a>
        <h1 style="margin-top:6px">${c.code || c.title}</h1>
        ${c.title && c.code ? raw(h`<div class="muted" style="font-weight:700;margin-top:4px">${c.title}</div>`) : raw('')}
      </header>

      <div class="stack">
        <div class="card">
          <div class="row" style="gap:16px">
            ${ring(att.pct ?? 0, { size: 84, stroke: 11, color: att.atRisk ? 'var(--red)' : 'var(--green)', label: `${pct}%` })}
            <div class="grow">
              <div style="font-weight:800">${att.present} of ${att.held} attended</div>
              <div class="dim" style="font-size:.85rem;margin-top:4px;font-weight:600">
                ${att.canMiss !== null
                  ? raw(h`You may still miss <strong>${att.canMiss}</strong> class${att.canMiss === 1 ? '' : 'es'} this semester.`)
                  : raw('Set the semester dates to get a miss budget.')}
              </div>
              <div class="muted" style="font-size:.76rem;margin-top:5px;font-weight:700">
                Threshold ${Math.round(att.threshold * 100)}%${att.planned ? ` · ${att.planned} classes planned` : ''}
              </div>
            </div>
          </div>
          <div class="row" style="margin-top:13px;gap:7px">
            <button class="btn btn--primary btn--sm grow" data-act="att" data-s="present">Present today</button>
            <button class="btn btn--ghost btn--sm grow" data-act="att" data-s="absent">Absent</button>
            <button class="btn btn--ghost btn--sm" data-act="history">Log</button>
          </div>
        </div>

        ${raw(courseStudyCard(c.id, state))}

        <div class="section-title"><span>Marks</span>
          <button class="btn btn--ghost btn--sm" data-act="weights">Weightages</button></div>
        ${!st.weightsValid ? raw(h`
          <div class="card card--warn">
            <p class="prose" style="margin:0">Your weightages add up to <strong>${st.totalWeight}%</strong>, not 100%.
            Fix them from your course outline or the projections below will be wrong.</p>
          </div>`) : raw('')}
        <div class="card stack-sm">
          ${WEIGHT_ORDER.filter((k) => Number(c.weights[k]) > 0).map((k) => {
            const m = c.marks[k];
            const got = m && m.total ? Math.round((m.obtained / m.total) * 100) : null;
            return raw(h`
              <button class="row-between" data-act="mark" data-k="${k}"
                      style="width:100%;background:transparent;border:0;padding:9px 0;font:inherit;color:inherit;cursor:pointer;text-align:left">
                <span class="grow">
                  <span style="display:block;font-weight:700">${WEIGHT_LABELS[k]}</span>
                  <span class="muted" style="font-size:.76rem;font-weight:700">${c.weights[k]}% of the course</span>
                </span>
                <span class="mono" style="font-weight:800">${m ? `${m.obtained}/${m.total}` : '—'}</span>
                ${got !== null ? raw(h`<span class="pill pill--${raw(got >= 80 ? 'accent' : got >= 60 ? 'gold' : 'danger')}">${got}%</span>`) : raw('<span class="listrow__chev">›</span>')}
              </button>`);
          })}
        </div>

        <div class="card">
          <div class="card__title">${icon('trend')} Where you stand</div>
          ${st.earnedOfGraded != null ? raw(h`
            <p class="prose">
              <strong>${st.earnedOfGraded.toFixed(1)}%</strong> across the ${st.gradedWeight}% of the course
              that has been marked. ${st.remainingWeight > 0
                ? raw(h`${st.remainingWeight}% is still unmarked.`)
                : raw('Everything is marked.')}
            </p>
            ${need != null ? raw(h`
              <p class="prose" style="margin:0">
                To finish on 80% overall you need to average <strong>${need > 100 ? 'more than 100' : need.toFixed(0)}%</strong>
                across what is left.${need > 100 ? ' That is not reachable — aim at the next grade band down and protect it.' : ''}
              </p>`) : raw('')}`)
            : raw('<p class="prose" style="margin:0">Enter some marks and this becomes the most useful box on the screen.</p>')}
          ${st.earnedOfGraded != null ? raw(h`
            <p class="muted" style="font-size:.76rem;margin-top:10px;font-weight:600">
              Indicative absolute grade at this percentage: <strong>${indicativeGrade(st.earnedOfGraded)}</strong>.
              FAST grades most courses relatively, so treat that as a rough marker only — not a prediction.
            </p>`) : raw('')}
        </div>

        <div class="section-title"><span>Final grade</span></div>
        <div class="card">
          <div class="row wrap" style="gap:7px">
            ${GRADE_ORDER.map((g) => raw(h`<button class="chip ${c.grade === g ? 'is-on' : ''}" data-act="grade" data-g="${g}">${g}</button>`))}
            <button class="chip ${c.grade === 'W' ? 'is-on' : ''}" data-act="grade" data-g="W">W</button>
          </div>
          <p class="muted" style="font-size:.76rem;margin-top:11px;font-weight:600">
            Enter it once results are out. ${c.grade && GRADE_POINTS[c.grade] != null ? `That is ${GRADE_POINTS[c.grade].toFixed(2)} grade points × ${c.creditHours} CH.` : ''}
          </p>
        </div>

        <div class="section-title"><span>Timetable</span>
          <button class="btn btn--ghost btn--sm" data-act="slots">Edit</button></div>
        <div class="card">
          ${c.slots?.length
            ? raw(h`<div class="stack-sm">${c.slots.map((s) => raw(h`
                <div class="row-between">
                  <span style="font-weight:700">${WEEKDAY_SHORT[s.day]}</span>
                  <span class="mono muted" style="font-weight:700">${s.start}–${s.end}${s.room ? ' · ' + s.room : ''}</span>
                </div>`))}</div>`)
            : raw('<p class="prose" style="margin:0">No slots set. Add them so attendance appears automatically on your Today screen.</p>')}
        </div>

        <div class="stack" style="margin-top:14px">
          <button class="btn btn--ghost btn--block" data-act="edit">Edit course details</button>
          <button class="btn btn--danger btn--block" data-act="delete">Delete course</button>
        </div>
      </div>
    </div>`;
}

function mountCourse(root, id) {
  actions(root, {
    studythis: () => openStudySheet(id),
    att: (el, ds) => {
      const paid = markAttendance(id, todayKey(), ds.s) === ATTEND.PRESENT;
      haptic(12);
      if (paid) { sfx('done'); xpBurst(UNI_XP.present, el, 'var(--blue)'); }
      refresh();
    },
    history: () => openAttendanceLog(id),
    mark: (el, ds) => openMarkSheet(id, ds.k),
    weights: () => openWeightsSheet(id),
    slots: () => openSlotsSheet(id),
    grade: (el, ds) => {
      const c = courseById(id);
      updateCourse(id, { grade: c.grade === ds.g ? null : ds.g });
      haptic(10);
      refresh();
    },
    edit: () => go(`uni/new?edit=${id}`),
    delete: async () => {
      const ok = await confirmSheet({
        title: 'Delete this course?',
        message: 'Its attendance record, marks and deadlines are deleted too. This cannot be undone.',
        confirmLabel: 'Delete', tone: 'danger',
      });
      if (ok) { deleteCourse(id); go('uni'); }
    },
  });
}

/* ------------------------------------------------------ course editor */

function renderCourseEditor(mode) {
  const editId = new URLSearchParams(location.hash.split('?')[1] || '').get('edit');
  const c = editId ? courseById(editId) : null;
  const cur = c || { code: '', title: '', instructor: '', section: '', creditHours: 3 };

  return h`
    <div class="screen">
      <header class="screen__head">
        <a href="#/uni" class="muted" style="font-size:.85rem">‹ Academics</a>
        <h1 style="margin-top:6px">${c ? 'Edit course' : 'New course'}</h1>
      </header>

      <label class="field"><span>Course code</span>
        <input type="text" id="cs-code" value="${cur.code}" placeholder="CS2001"></label>
      <label class="field"><span>Title</span>
        <input type="text" id="cs-title" value="${cur.title}" placeholder="Data Structures"></label>
      <label class="field"><span>Instructor</span>
        <input type="text" id="cs-inst" value="${cur.instructor}" placeholder="Optional"></label>
      <label class="field"><span>Section</span>
        <input type="text" id="cs-sec" value="${cur.section}" placeholder="BCS-3A"></label>
      <label class="field"><span>Credit hours</span>
        <input type="number" id="cs-ch" min="0" max="6" step="1" value="${cur.creditHours}"></label>

      ${!c ? raw(h`
        <div class="field">
          <span style="display:block;font-size:.82rem;font-weight:800;margin-bottom:7px">Type</span>
          <div class="row wrap" style="gap:7px">
            ${COURSE_PRESETS.map((p, i) => raw(h`<button type="button" class="chip ${i === 0 ? 'is-on' : ''}" data-preset="${p.id}">${p.label}</button>`))}
          </div>
          <span class="hint">Sets the credit hours and a starting weightage split. You can change both afterwards.</span>
        </div>`) : raw('')}

      <button class="btn btn--primary btn--lg btn--block" style="margin-top:10px" data-act="save">${c ? 'Save changes' : 'Add course'}</button>
    </div>`;
}

function mountCourseEditor(root) {
  const editId = new URLSearchParams(location.hash.split('?')[1] || '').get('edit');
  let preset = COURSE_PRESETS[0];

  root.addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-preset]');
    if (!p) return;
    preset = COURSE_PRESETS.find((x) => x.id === p.dataset.preset) || COURSE_PRESETS[0];
    root.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-on', b === p));
    root.querySelector('#cs-ch').value = preset.creditHours;
    haptic(8);
  });

  actions(root, {
    save: () => {
      const val = (id) => root.querySelector(id).value.trim();
      const code = val('#cs-code');
      const title = val('#cs-title');
      if (!code && !title) { toast('Give it a code or a title', { tone: 'warn' }); return; }
      const patch = {
        code, title,
        instructor: val('#cs-inst'),
        section: val('#cs-sec'),
        creditHours: Number(root.querySelector('#cs-ch').value) || 0,
      };
      if (editId) { updateCourse(editId, patch); go(`uni/course/${editId}`); }
      else {
        const c = addCourse({ ...patch, weights: { ...preset.weights } });
        toast('Course added — now add its timetable slots', { tone: 'good' });
        go(`uni/course/${c.id}`);
      }
      haptic([14, 30, 20]);
    },
  });
}

/* --------------------------------------------------------------- sheets */

function openMarkSheet(courseId, component) {
  const c = courseById(courseId);
  const m = c.marks[component] || {};
  sheet({
    title: WEIGHT_LABELS[component],
    body: h`
      <div class="stack">
        <div class="row" style="gap:10px">
          <label class="field grow" style="margin:0"><span>Obtained</span>
            <input type="number" id="mk-got" step="0.5" value="${m.obtained ?? ''}" placeholder="0"></label>
          <label class="field grow" style="margin:0"><span>Out of</span>
            <input type="number" id="mk-tot" step="0.5" value="${m.total ?? ''}" placeholder="0"></label>
        </div>
        <p class="muted" style="font-size:.8rem;font-weight:600">
          Worth ${c.weights[component]}% of the course. Leave both blank to clear it.
        </p>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Save</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        if (!ev.target.closest('[data-save]')) return;
        setMark(courseId, component, el.querySelector('#mk-got').value, el.querySelector('#mk-tot').value);
        close();
        refresh();
      });
    },
  });
}

function openWeightsSheet(courseId) {
  const c = courseById(courseId);
  sheet({
    title: 'Weightages',
    size: 'full',
    body: h`
      <div class="stack">
        <p class="prose">Copy these straight off your course outline. Your instructor sets them, and they
        must total 100 for the projections to mean anything.</p>
        ${WEIGHT_ORDER.map((k) => raw(h`
          <label class="field" style="margin-bottom:10px">
            <span>${WEIGHT_LABELS[k]}</span>
            <input type="number" data-w="${k}" min="0" max="100" step="1" value="${c.weights[k] ?? 0}">
          </label>`))}
        <div class="card card--info"><p class="prose" style="margin:0">Total: <strong id="w-total">—</strong></p></div>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Save weightages</button>`,
    onMount: (el, close) => {
      const total = () => Array.from(el.querySelectorAll('[data-w]')).reduce((n, i) => n + (Number(i.value) || 0), 0);
      const paint = () => { el.querySelector('#w-total').textContent = `${total()}%`; };
      paint();
      el.addEventListener('input', paint);
      el.addEventListener('click', (ev) => {
        if (!ev.target.closest('[data-save]')) return;
        const weights = {};
        el.querySelectorAll('[data-w]').forEach((i) => { weights[i.dataset.w] = Number(i.value) || 0; });
        updateCourse(courseId, { weights });
        close();
        if (total() !== 100) toast(`Saved, but they total ${total()}% — not 100%`, { tone: 'warn' });
        refresh();
      });
    },
  });
}

function openSlotsSheet(courseId) {
  const c = courseById(courseId);
  let slots = (c.slots || []).map((s) => ({ ...s }));

  const rows = () => slots.map((s, i) => h`
    <div class="card" style="padding:11px">
      <div class="row" style="gap:7px">
        <select data-slot="${i}" data-f="day" style="min-height:44px">
          ${WEEKDAY_SHORT.map((d, di) => raw(h`<option value="${di}" ${s.day === di ? 'selected' : ''}>${d}</option>`))}
        </select>
        <button class="iconbtn" data-rm="${i}" aria-label="Remove">&times;</button>
      </div>
      <div class="row" style="gap:7px;margin-top:8px">
        <input type="time" data-slot="${i}" data-f="start" value="${s.start || ''}" style="min-height:44px">
        <input type="time" data-slot="${i}" data-f="end" value="${s.end || ''}" style="min-height:44px">
      </div>
      <input type="text" data-slot="${i}" data-f="room" value="${s.room || ''}" placeholder="Room (optional)" style="margin-top:8px;min-height:44px">
    </div>`).join('');

  sheet({
    title: 'Timetable slots',
    size: 'full',
    body: h`
      <div class="stack">
        <p class="prose">One row per weekly class. These are what put the course on your Today screen and
        what the miss-budget is calculated from.</p>
        <div id="slot-rows" class="stack-sm">${raw(rows())}</div>
        <button class="btn btn--ghost btn--block" data-add="1">Add a slot</button>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Save timetable</button>`,
    onMount: (el, close) => {
      const repaint = () => { el.querySelector('#slot-rows').innerHTML = rows(); };
      const sync = () => {
        el.querySelectorAll('[data-slot]').forEach((i) => {
          const s = slots[Number(i.dataset.slot)];
          if (!s) return;
          s[i.dataset.f] = i.dataset.f === 'day' ? Number(i.value) : i.value;
        });
      };
      el.addEventListener('change', sync);
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-add]')) {
          sync();
          slots.push({ day: 1, start: '08:30', end: '09:50', room: '' });
          repaint();
          return;
        }
        const rm = ev.target.closest('[data-rm]');
        if (rm) { sync(); slots.splice(Number(rm.dataset.rm), 1); repaint(); return; }
        if (ev.target.closest('[data-save]')) {
          sync();
          updateCourse(courseId, { slots: slots.filter((s) => s.start && s.end) });
          close();
          refresh();
        }
      });
    },
  });
}

function openAttendanceLog(courseId) {
  const state = getState();
  const book = state.academics.attendance[courseId] || {};
  const days = Object.keys(book).sort().reverse();

  sheet({
    title: 'Attendance log',
    size: 'full',
    body: days.length ? h`
      <div class="stack-sm">
        ${days.map((d) => raw(h`
          <div class="row-between card" style="padding:11px 13px">
            <span style="font-weight:700">${prettyDay(d)}</span>
            <span class="pill pill--${raw(book[d] === 'present' ? 'accent' : book[d] === 'absent' ? 'danger' : 'blue')}">${book[d]}</span>
          </div>`))}
      </div>` : h`<p class="prose">Nothing marked yet.</p>`,
  });
}

function openTaskSheet() {
  const courses = activeCourses();
  sheet({
    title: 'New deadline',
    body: h`
      <div class="stack">
        <label class="field"><span>What is it?</span>
          <input type="text" id="tk-title" placeholder="Assignment 2 — linked lists"></label>
        <label class="field"><span>Course</span>
          <select id="tk-course">
            <option value="">No course</option>
            ${courses.map((c) => raw(h`<option value="${c.id}">${c.code || c.title}</option>`))}
          </select></label>
        <label class="field"><span>Type</span>
          <select id="tk-type">
            ${TASK_TYPES.map((t) => raw(h`<option value="${t.id}">${t.label}</option>`))}
          </select></label>
        <label class="field"><span>Due</span>
          <input type="date" id="tk-due" value="${todayKey()}"></label>
      </div>`,
    footer: h`<button class="btn btn--primary btn--block" data-save="1">Add deadline</button>`,
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        if (!ev.target.closest('[data-save]')) return;
        const title = el.querySelector('#tk-title').value.trim();
        if (!title) { toast('Give it a name', { tone: 'warn' }); return; }
        addTask({
          title,
          courseId: el.querySelector('#tk-course').value || null,
          type: el.querySelector('#tk-type').value,
          due: el.querySelector('#tk-due').value || null,
        });
        close();
        refresh();
      });
    },
  });
}
