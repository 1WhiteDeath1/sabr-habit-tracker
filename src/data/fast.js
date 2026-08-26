// fast.js — FAST-NUCES specifics.
//
// A note on accuracy: the 4.0 grade-point mapping below is the standard NUCES
// scale, but **assessment weightages are set per course by the instructor** and
// the exact attendance threshold is set by your programme. Both are therefore
// defaults you can edit, not rules the app enforces on your behalf. Confirm the
// numbers against your course outline and the student handbook — the app will
// use whatever you tell it.

export const UNIVERSITY = 'FAST-NUCES';

export const CAMPUSES = [
  'Islamabad', 'Lahore', 'Karachi', 'Peshawar', 'Faisalabad (Chiniot)', 'Multan',
];

export const PROGRAMS = [
  'BS Computer Science', 'BS Software Engineering', 'BS Artificial Intelligence',
  'BS Data Science', 'BS Cyber Security', 'BS Electrical Engineering',
  'BS Computer Engineering', 'BS Business Analytics', 'BBA', 'BS Accounting & Finance',
  'MS / Graduate', 'Other',
];

/** The standard NUCES 4.0 scale. */
export const GRADE_POINTS = {
  'A':  4.00,
  'A-': 3.67,
  'B+': 3.33,
  'B':  3.00,
  'B-': 2.67,
  'C+': 2.33,
  'C':  2.00,
  'C-': 1.67,
  'D+': 1.33,
  'D':  1.00,
  'F':  0.00,
};
export const GRADE_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];

/** Grades that carry credit but no grade point, so they sit outside the GPA. */
export const NON_GPA_GRADES = ['W', 'I'];

/**
 * Default assessment weightages. Every course at FAST sets its own, so these are
 * a starting point that you edit per course from the course outline.
 * They must total 100 for the projection maths to mean anything.
 */
export const DEFAULT_WEIGHTS = {
  quizzes:     10,
  assignments: 10,
  sessional1:  15,
  sessional2:  15,
  project:     10,
  final:       40,
};

export const WEIGHT_LABELS = {
  quizzes:     'Quizzes',
  assignments: 'Assignments',
  sessional1:  'Sessional I',
  sessional2:  'Sessional II',
  project:     'Project / Lab',
  final:       'Final exam',
};
export const WEIGHT_ORDER = ['quizzes', 'assignments', 'sessional1', 'sessional2', 'project', 'final'];

/**
 * Default minimum attendance required to sit the final exam.
 * FAST-NUCES enforces a short-attendance rule; 80% is the commonly applied
 * figure, but confirm yours — this is editable in Settings for that reason.
 */
export const DEFAULT_ATTENDANCE_THRESHOLD = 0.80;

export const SEMESTER_NAMES = ['Fall', 'Spring', 'Summer'];

/**
 * An indicative absolute scale, shown only as a rough reference.
 * FAST grades most courses relatively (on the class curve), so a percentage
 * does NOT reliably determine a letter grade. The app never auto-assigns a
 * grade from a percentage for exactly this reason.
 */
export const INDICATIVE_SCALE = [
  { grade: 'A',  min: 85 }, { grade: 'A-', min: 80 }, { grade: 'B+', min: 75 },
  { grade: 'B',  min: 70 }, { grade: 'B-', min: 65 }, { grade: 'C+', min: 60 },
  { grade: 'C',  min: 55 }, { grade: 'C-', min: 50 }, { grade: 'D+', min: 45 },
  { grade: 'D',  min: 40 }, { grade: 'F',  min: 0 },
];

export function indicativeGrade(percent) {
  if (percent == null || Number.isNaN(percent)) return null;
  return (INDICATIVE_SCALE.find((row) => percent >= row.min) || { grade: 'F' }).grade;
}

/** Course-type presets, so adding a lab does not mean retyping the weightages. */
export const COURSE_PRESETS = [
  { id: 'theory', label: 'Theory course', creditHours: 3, weights: DEFAULT_WEIGHTS },
  { id: 'lab',    label: 'Lab', creditHours: 1,
    weights: { quizzes: 10, assignments: 30, sessional1: 0, sessional2: 0, project: 20, final: 40 } },
  { id: 'project',label: 'Project / FYP', creditHours: 3,
    weights: { quizzes: 0, assignments: 0, sessional1: 20, sessional2: 20, project: 60, final: 0 } },
];
