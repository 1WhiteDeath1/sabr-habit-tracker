// academics.js — the university engine.
//
// The two things a FAST student actually needs a tool for, day to day:
//   1. "Am I about to get short attendance in this course?" — answered as a
//      concrete number of classes you may still miss, not a percentage you have
//      to reason about at 8am.
//   2. "Where do I actually stand in this course?" — answered from the marks
//      you have entered, weighted by the course's own scheme, and honest about
//      how much of the assessment is still unmarked.
//
// Grades are never auto-assigned from percentages. FAST grades most courses
// relatively, so a percentage does not determine a letter — see data/fast.js.

import { getState, mutate } from './store.js';
import { uid } from './schema.js';
import { grantXp, comboMultiplier } from './game.js';
import { todayKey, keyToDate, dayKeyFromLocalDate, weekdayOf, addDays, parseHM, daysBetween, rangeKeys } from './dates.js';
import {
  GRADE_POINTS, NON_GPA_GRADES, DEFAULT_WEIGHTS, WEIGHT_ORDER,
  DEFAULT_ATTENDANCE_THRESHOLD, UNIVERSITY,
} from '../data/fast.js';

export const ATTEND = { PRESENT: 'present', ABSENT: 'absent', EXCUSED: 'excused', CANCELLED: 'cancelled' };

/** Statuses that count toward the attendance denominator. */
const COUNTED = new Set([ATTEND.PRESENT, ATTEND.ABSENT]);

/* ------------------------------------------------------------- courses */

export function makeCourse(patch = {}) {
  return {
    id: uid('c'),
    code: '',
    title: '',
    instructor: '',
    section: '',
    creditHours: 3,
    slots: [],                 // [{day: 0-6, start: 'HH:MM', end: 'HH:MM', room}]
    weights: { ...DEFAULT_WEIGHTS },
    marks: {},                 // component -> {obtained, total}
    grade: null,               // letter grade, entered by you once known
    archived: false,
    createdAt: Date.now(),
    ...patch,
  };
}

export function addCourse(patch) {
  const course = makeCourse(patch);
  mutate((s) => {
    s.academics.enabled = true;
    s.academics.courses.push(course);
  });
  return course;
}

export function updateCourse(id, patch) {
  mutate((s) => {
    const c = s.academics.courses.find((x) => x.id === id);
    if (!c) return false;
    Object.assign(c, patch);
  });
}

export function deleteCourse(id) {
  mutate((s) => {
    s.academics.courses = s.academics.courses.filter((c) => c.id !== id);
    delete s.academics.attendance[id];
    s.academics.tasks = s.academics.tasks.filter((t) => t.courseId !== id);
  });
}

export function courseById(id, state = getState()) {
  return state.academics.courses.find((c) => c.id === id) || null;
}

export function activeCourses(state = getState()) {
  return state.academics.courses.filter((c) => !c.archived);
}

/* ---------------------------------------------------------- timetable */

/** Classes scheduled on a given day, sorted by start time. */
export function classesOn(key = todayKey(), state = getState()) {
  const dow = weekdayOf(key);
  const out = [];
  for (const course of activeCourses(state)) {
    for (const slot of course.slots || []) {
      if (slot.day !== dow) continue;
      out.push({
        course,
        slot,
        at: parseHM(slot.start) ?? 0,
        status: state.academics.attendance[course.id]?.[key] || null,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** How many sessions of this course fall between two dates, per its timetable. */
export function plannedSessions(course, fromKey, toKey) {
  if (!fromKey || !toKey || !course.slots?.length) return 0;
  const perWeekday = new Map();
  for (const slot of course.slots) perWeekday.set(slot.day, (perWeekday.get(slot.day) || 0) + 1);

  let total = 0;
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard++ < 400) {
    total += perWeekday.get(weekdayOf(cur)) || 0;
    cur = addDays(cur, 1);
  }
  return total;
}

/* --------------------------------------------------------- attendance */

export function markAttendance(courseId, key, status) {
  const current = getState().academics.attendance[courseId]?.[key];
  const clearing = current === status;
  mutate((s) => {
    const book = (s.academics.attendance[courseId] ||= {});
    if (clearing) delete book[key];
    else book[key] = status;
    if (!Object.keys(book).length) delete s.academics.attendance[courseId];
  });
  // Turning up is a behaviour worth reinforcing like any other.
  if (!clearing && status === ATTEND.PRESENT && current !== ATTEND.PRESENT) {
    grantXp(UNI_XP.present, 'aql');
  }
  return clearing ? null : status;
}

/**
 * The number that matters: attendance so far, and how many more classes you can
 * still afford to miss before you fall under the threshold for the whole
 * semester. Returns `canMiss: null` when the semester dates are not set, since
 * without them there is no honest projection to make.
 */
export function attendanceFor(course, state = getState()) {
  const book = state.academics.attendance[course.id] || {};
  const entries = Object.entries(book);

  const present = entries.filter(([, v]) => v === ATTEND.PRESENT).length;
  const absent = entries.filter(([, v]) => v === ATTEND.ABSENT).length;
  const held = present + absent;
  const pct = held ? present / held : null;

  const threshold = state.academics.attendanceThreshold || DEFAULT_ATTENDANCE_THRESHOLD;
  const sem = state.academics.semester || {};

  let planned = null;
  let canMiss = null;
  if (sem.startDate && sem.endDate) {
    // Sessions the timetable says exist, minus any you marked cancelled.
    const cancelled = entries.filter(([, v]) => v === ATTEND.CANCELLED).length;
    const excused = entries.filter(([, v]) => v === ATTEND.EXCUSED).length;
    planned = Math.max(held, plannedSessions(course, sem.startDate, sem.endDate) - cancelled - excused);
    const mustAttend = Math.ceil(threshold * planned);
    canMiss = Math.max(0, (planned - mustAttend) - absent);
  }

  return {
    present, absent, held, planned, pct, threshold, canMiss,
    // Under threshold already, or projected to fall under it.
    atRisk: pct != null && pct < threshold,
    doomed: canMiss === 0 && planned != null && absent > (planned - Math.ceil(threshold * planned)),
  };
}

/** Attendance across every course, worst first — drives the warning on Today. */
export function attendanceOverview(state = getState()) {
  return activeCourses(state)
    .map((course) => ({ course, ...attendanceFor(course, state) }))
    .filter((row) => row.held > 0)
    .sort((a, b) => (a.pct ?? 1) - (b.pct ?? 1));
}

/* --------------------------------------------------------------- marks */

export function setMark(courseId, component, obtained, total) {
  mutate((s) => {
    const c = s.academics.courses.find((x) => x.id === courseId);
    if (!c) return false;
    if (obtained === null || obtained === '' || total === null || total === '' || !Number(total)) {
      delete c.marks[component];
    } else {
      c.marks[component] = { obtained: Number(obtained), total: Number(total) };
    }
  });
}

/**
 * Where you stand, weighted by the course's own scheme.
 * `earnedOfGraded` is your percentage across only the components that have been
 * marked — the honest number. `earnedOfTotal` assumes everything unmarked is a
 * zero, which is the floor, not a prediction.
 */
export function courseStanding(course) {
  const weights = course.weights || DEFAULT_WEIGHTS;
  let gradedWeight = 0;
  let earnedWeight = 0;
  let totalWeight = 0;

  for (const key of WEIGHT_ORDER) {
    const w = Number(weights[key] || 0);
    totalWeight += w;
    const m = course.marks?.[key];
    if (!w || !m || !m.total) continue;
    gradedWeight += w;
    earnedWeight += w * (m.obtained / m.total);
  }

  return {
    totalWeight,
    gradedWeight,
    remainingWeight: Math.max(0, totalWeight - gradedWeight),
    earnedOfGraded: gradedWeight ? (earnedWeight / gradedWeight) * 100 : null,
    earnedOfTotal: totalWeight ? (earnedWeight / totalWeight) * 100 : null,
    weightsValid: totalWeight === 100,
  };
}

/**
 * What you must average across the remaining components to finish on `target`
 * percent overall. Returns null when nothing is left, and can exceed 100 —
 * which is itself the useful answer.
 */
export function neededForTarget(course, targetPercent) {
  const s = courseStanding(course);
  if (!s.remainingWeight) return null;
  const earnedPoints = (s.earnedOfTotal ?? 0) * s.totalWeight / 100;
  const needPoints = targetPercent * s.totalWeight / 100 - earnedPoints;
  return (needPoints / s.remainingWeight) * 100;
}

/* ----------------------------------------------------------------- GPA */

export function gradePoints(letter) {
  return GRADE_POINTS[letter] ?? null;
}

/** GPA for a list of courses that have letter grades entered. */
export function gpaOf(courses) {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    if (!c.grade || NON_GPA_GRADES.includes(c.grade)) continue;
    const gp = gradePoints(c.grade);
    if (gp == null) continue;
    const ch = Number(c.creditHours) || 0;
    points += gp * ch;
    credits += ch;
  }
  return { gpa: credits ? points / credits : null, credits, points };
}

/** CGPA across saved past semesters plus whatever is graded this semester. */
export function cgpaOf(state = getState()) {
  const past = state.academics.history || [];
  let points = past.reduce((sum, h) => sum + (Number(h.gpa) || 0) * (Number(h.credits) || 0), 0);
  let credits = past.reduce((sum, h) => sum + (Number(h.credits) || 0), 0);

  const current = gpaOf(activeCourses(state));
  points += current.points;
  credits += current.credits;

  return { cgpa: credits ? points / credits : null, credits, semesterGpa: current.gpa };
}

export function saveSemesterToHistory() {
  const state = getState();
  const { gpa, credits } = gpaOf(activeCourses(state));
  if (gpa == null || !credits) return false;
  const label = `${state.academics.semester?.name || 'Semester'}`;
  mutate((s) => {
    s.academics.history.push({ id: uid('h'), label, gpa, credits, at: Date.now() });
    for (const c of s.academics.courses) c.archived = true;
  });
  return true;
}

/* --------------------------------------------------------------- tasks */

export const TASK_TYPES = [
  { id: 'assignment', label: 'Assignment', icon: 'ledger' },
  { id: 'quiz',       label: 'Quiz',       icon: 'flask' },
  { id: 'sessional',  label: 'Sessional',  icon: 'books' },
  { id: 'project',    label: 'Project',    icon: 'wrench' },
  { id: 'final',      label: 'Final',      icon: 'cap' },
];

export function addTask({ courseId, title, type = 'assignment', due }) {
  const task = { id: uid('at'), courseId, title, type, due, done: false, createdAt: Date.now() };
  mutate((s) => { s.academics.tasks.push(task); });
  return task;
}

/**
 * Close or reopen a deadline.
 *
 * Paid once, on the first close, and never again: without the `xp` guard a
 * finished assignment could be un-ticked and re-ticked for points forever, and
 * the one thing this app cannot afford is a way to earn XP that has nothing to
 * do with the behaviour it is meant to be measuring. Reopening never deducts.
 */
export function toggleTask(id) {
  let nowDone = false;
  let payout = 0;
  mutate((s) => {
    const t = s.academics.tasks.find((x) => x.id === id);
    if (!t) return false;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    nowDone = t.done;
    if (nowDone && !t.xp) {
      const v = taskValue(t);
      t.xp = v.total;
      t.earlyDays = v.daysEarly;
      payout = v.total;
    }
  });
  if (payout) grantXp(payout, 'aql');
  return nowDone;
}

export function deleteTask(id) {
  mutate((s) => { s.academics.tasks = s.academics.tasks.filter((t) => t.id !== id); });
}

/**
 * Open deadlines from today forward, soonest first.
 *
 * Anything already past due belongs to overdueTasks() and only to it — without
 * the lower bound both lists returned it, and every caller concatenates the two,
 * so a late assignment appeared twice on Today and twice in the bell.
 */
export function upcomingTasks(state = getState(), withinDays = 21) {
  const today = todayKey();
  const limit = addDays(today, withinDays);
  return state.academics.tasks
    .filter((t) => !t.done && t.due && t.due >= today && t.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function overdueTasks(state = getState()) {
  const today = todayKey();
  return state.academics.tasks.filter((t) => !t.done && t.due && t.due < today);
}

/* ====================================================================== */
/* The semester as a scoreboard.                                          */
/*                                                                        */
/* University used to be the one module that took from the game without   */
/* giving anything back: it sat behind a price, and the only XP in it was */
/* eight points for marking a class present that nothing ever showed you. */
/* It is free now, and it earns.                                          */
/*                                                                        */
/* Four sources, in rising order of how much they actually predict a good */
/* semester:                                                              */
/*                                                                        */
/*   present     turning up, per class                                    */
/*   study       logged minutes of work outside class                     */
/*   task        closing a deadline, worth more the earlier you close it  */
/*   weekClear   a whole week with no absences                            */
/*                                                                        */
/* The rates are set against the rest of the app rather than invented. A  */
/* full habit is 14 XP; a fifty-minute focus block is 40. Ninety minutes  */
/* of study is 45, four classes attended is 32, so a strong university    */
/* day lands near a strong habit day and neither drowns the other out.    */
/* ====================================================================== */

export const UNI_XP = {
  present: 8,

  // Study is paid by the minute with a daily ceiling, because the failure mode
  // of paying for self-reported time is a person typing 600 minutes on Sunday.
  // The ceiling is roughly a real evening's work; past that the app stops
  // paying and says so, which is a more honest signal than an unbounded number.
  studyPerMin: 0.5,
  studyDayCap: 90,
  studyMinSession: 5,
  studyMaxSession: 240,

  // A quiz closed is not a final closed. Weighted by what each one costs you
  // to have left undone.
  task: { assignment: 22, quiz: 16, sessional: 34, project: 45, final: 55 },

  // Finishing early is the whole skill, so it is the part with the bonus:
  // three XP per whole day of daylight between finishing and the deadline,
  // capped at a week. Nothing is ever deducted for finishing late.
  earlyPerDay: 3,
  earlyMax: 21,

  weekClear: 45,
};

/** Minutes in a day below which it does not count as a study day. */
export const STUDY_MIN_DAY = 15;

/* -------------------------------------------------------------- study */

function studyList(state = getState()) {
  return Array.isArray(state.academics.study) ? state.academics.study : [];
}

/** Minutes logged on one day, across every course. */
export function studyOn(key, state = getState()) {
  return studyList(state).filter((e) => e.day === key).reduce((n, e) => n + e.minutes, 0);
}

/**
 * Log a block of study.
 *
 * Pays only the minutes still under today's ceiling, and multiplies by the same
 * streak combo the habits use — consistency is the thing being bought here, not
 * volume, and a person studying forty minutes every day should out-earn a person
 * doing four hours once a week. Returns everything the UI needs to explain the
 * number it is about to show you, including how much went unpaid.
 */
export function logStudy({ courseId = null, minutes, note = '' }) {
  const mins = Math.max(UNI_XP.studyMinSession,
    Math.min(UNI_XP.studyMaxSession, Math.round(Number(minutes) || 0)));
  const key = todayKey();
  const already = studyOn(key);
  const payable = Math.max(0, Math.min(mins, UNI_XP.studyDayCap - already));
  const combo = comboMultiplier(studyStreak());
  const xp = Math.round(payable * UNI_XP.studyPerMin * combo);

  const entry = {
    id: uid('sy'), courseId, day: key, minutes: mins,
    paid: payable, xp, note: String(note || '').slice(0, 120), at: Date.now(),
  };
  mutate((s) => {
    if (!Array.isArray(s.academics.study)) s.academics.study = [];
    s.academics.study.push(entry);
  });
  if (xp) grantXp(xp, 'aql');

  return { entry, xp, minutes: mins, paid: payable, unpaid: mins - payable, combo, capped: payable < mins };
}

export function deleteStudy(id) {
  // The XP stays. Nothing in this app takes points back, and a mistyped number
  // you are afraid to correct is worse than a few points you did not earn.
  mutate((s) => { s.academics.study = studyList(s).filter((e) => e.id !== id); });
}

/**
 * Consecutive days ending today or yesterday with a real amount of study on
 * them. Yesterday counts as the anchor so the streak does not appear broken
 * every morning before you have started.
 */
export function studyStreak(state = getState()) {
  const today = todayKey();
  let cursor = studyOn(today, state) >= STUDY_MIN_DAY ? today : addDays(today, -1);
  let run = 0;
  for (let i = 0; i < 400; i += 1) {
    if (studyOn(cursor, state) < STUDY_MIN_DAY) break;
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}

/** Totals for the study card: today, this week, and the whole semester. */
export function studyTotals(state = getState()) {
  const today = todayKey();
  const weekFrom = addDays(today, -6);
  const list = studyList(state);
  const sum = (rows) => rows.reduce((n, e) => n + e.minutes, 0);

  const byCourse = {};
  for (const e of list) {
    if (!e.courseId) continue;
    byCourse[e.courseId] = (byCourse[e.courseId] || 0) + e.minutes;
  }

  const todayMins = sum(list.filter((e) => e.day === today));
  return {
    today: todayMins,
    week: sum(list.filter((e) => e.day >= weekFrom)),
    total: sum(list),
    sessions: list.length,
    byCourse,
    streak: studyStreak(state),
    capLeft: Math.max(0, UNI_XP.studyDayCap - todayMins),
    atCap: todayMins >= UNI_XP.studyDayCap,
  };
}

export function studyForCourse(courseId, state = getState()) {
  return studyList(state).filter((e) => e.courseId === courseId);
}

/* ---------------------------------------------------------- deadlines */

/** What closing this task is worth, and why. Pure — safe to call while rendering. */
export function taskValue(task, onDay = todayKey()) {
  const base = UNI_XP.task[task?.type] ?? UNI_XP.task.assignment;
  const daysEarly = task?.due ? Math.max(0, daysBetween(onDay, task.due)) : 0;
  const early = Math.min(UNI_XP.earlyMax, daysEarly * UNI_XP.earlyPerDay);
  return { base, early, daysEarly, total: base + early };
}

/* -------------------------------------------------- the perfect week */

/** Monday-anchored key for the week containing `key`. */
function weekStartKey(key) {
  const dow = weekdayOf(key);
  return addDays(key, -((dow + 6) % 7));
}

/**
 * Last week, if it was clean and has not been claimed yet.
 *
 * Deliberately claimed by hand rather than paid out silently on boot. A reward
 * that appears in a total you were not watching is not a reward; one you have
 * to tap for is a small ceremony, and it puts the fact that you did not miss a
 * class in front of you at the start of the week that follows it.
 */
export function weekBonus(state = getState(), key = todayKey()) {
  const week = addDays(weekStartKey(key), -7);
  const claimed = Array.isArray(state.academics.weekBonuses) ? state.academics.weekBonuses : [];
  if (claimed.includes(week)) return { available: false, week };

  const days = new Set(rangeKeys(week, addDays(week, 6)));
  let present = 0;
  let missed = 0;
  for (const book of Object.values(state.academics.attendance || {})) {
    for (const [day, status] of Object.entries(book)) {
      if (!days.has(day)) continue;
      if (status === ATTEND.PRESENT) present += 1;
      if (status === ATTEND.ABSENT) missed += 1;
    }
  }
  // Three is the floor for calling it a week: below that "no absences" is more
  // likely to mean nothing was logged than that nothing was missed.
  return {
    available: missed === 0 && present >= 3,
    week, present, missed, xp: UNI_XP.weekClear,
  };
}

export function claimWeekBonus() {
  const b = weekBonus();
  if (!b.available) return null;
  mutate((s) => {
    if (!Array.isArray(s.academics.weekBonuses)) s.academics.weekBonuses = [];
    s.academics.weekBonuses.push(b.week);
  });
  grantXp(UNI_XP.weekClear, 'aql');
  return b;
}

/* --------------------------------------------------------- scoreboard */

/**
 * Everything university has paid you, by source.
 *
 * Derived from the records rather than accumulated in a counter, so it cannot
 * drift and it survives an import. Attendance is counted rather than stored,
 * which means a change to the rate reprices history — acceptable here, and far
 * better than a stored total that disagrees with the classes it claims to be
 * about.
 */
export function semesterScore(state = getState()) {
  let present = 0;
  for (const book of Object.values(state.academics.attendance || {})) {
    present += Object.values(book).filter((v) => v === ATTEND.PRESENT).length;
  }
  const done = state.academics.tasks.filter((t) => t.done);
  const tasks = done.reduce((n, t) => n + (Number(t.xp) || 0), 0);
  const study = studyList(state).reduce((n, e) => n + (Number(e.xp) || 0), 0);
  const weeks = (state.academics.weekBonuses || []).length;

  const rows = [
    { id: 'present', label: 'Classes attended', icon: 'cap',   n: present, xp: present * UNI_XP.present },
    { id: 'study',   label: 'Study logged',     icon: 'books', n: studyList(state).length, xp: study },
    { id: 'task',    label: 'Deadlines closed', icon: 'check', n: done.length, xp: tasks },
    { id: 'week',    label: 'Perfect weeks',    icon: 'flame', n: weeks, xp: weeks * UNI_XP.weekClear },
  ];
  return { rows, total: rows.reduce((n, r) => n + r.xp, 0) };
}

export { UNIVERSITY, WEIGHT_ORDER };
