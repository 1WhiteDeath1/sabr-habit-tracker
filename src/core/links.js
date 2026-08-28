// links.js — what a habit on Today is actually feeding.
//
// The two screens were running the same numbers past each other. You could
// name a pursuit, accept a seven-day trial, and sit two seals from a rank, and
// Today would not mention any of it — the row you were about to tap looked
// exactly like the row that fed nothing. Meanwhile the Ascent talked about
// runs and tiers and never named the one habit that would move them.
//
// This module is the join. It answers one question in both directions: which
// of the things you have committed to does this specific habit advance?
//
// Deliberately conservative. A link is only reported where the goal names
// something a habit demonstrably satisfies — a title, a category, a prayer
// anchor, or simply being kept at all. Goals about urges, focus blocks,
// classes or reviews are not habit-shaped and are left alone; a badge that is
// sometimes wrong is worse than no badge, because it teaches you to stop
// reading them.

import { getState } from './store.js';
import { todayKey } from './dates.js';
import { mainBoard, pursuit, PURSUIT_BONUS } from './quests.js';
import { activeTrial, trialProgress, daysLeft, TRIAL_BY_ID } from './trials.js';
import { nextGate } from './ascend.js';

function normalize(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Does this habit satisfy a goal of the given type and args? */
function habitFeeds(habit, type, args = {}) {
  switch (type) {
    // "any habit at all", so everything counts
    case 'keptDays':
    case 'perfectDays':
      return true;
    case 'habitDays':
    case 'habitTitleDays':
      return normalize(habit.title).includes(args.match)
        || normalize(habit.tiny).includes(args.match);
    case 'categoryDays':
      return habit.category === args.category;
    case 'prayerAnchorDays':
      return habit.anchorPrayer === args.prayer;
    default:
      // studyDays, classesAttended, focusSessions, urgesSurvived, cleanDays,
      // shutdowns, reviews, guardsAndPlans, uniTasksDone — none of these are
      // moved by ticking a habit row.
      return false;
  }
}

/**
 * Everything currently committed to, measured once.
 *
 * Read at the top of a render and passed down, rather than recomputed per row:
 * a fifteen-habit day would otherwise walk the whole log fifteen times.
 */
export function campaign(state = getState(), key = todayKey()) {
  const rec = activeTrial(state);
  const trial = rec ? {
    rec,
    spec: TRIAL_BY_ID[rec.id],
    progress: trialProgress(rec, state),
    daysLeft: daysLeft(rec),
  } : null;

  const p = pursuit(state);
  const gate = nextGate(state);

  return { trial, pursuit: p, gate };
}

/**
 * What this habit advances, given a campaign snapshot.
 *
 * Returns at most two links — the trial first, because it is the one with a
 * deadline. Three badges on a row is a row nobody reads.
 */
export function habitLinks(habit, camp) {
  const out = [];

  if (camp.trial && !camp.trial.progress.met) {
    const { spec, progress, daysLeft: left } = camp.trial;
    if (habitFeeds(habit, spec.metric, spec.args || {})) {
      out.push({
        kind: 'trial',
        label: spec.title,
        detail: `${progress.raw}/${progress.target} · ${left}d left`,
        urgent: left <= 2,
      });
    }
  }

  if (camp.pursuit) {
    const { quest, progress } = camp.pursuit;
    if (habitFeeds(habit, quest.goal.type, quest.goal)) {
      out.push({
        kind: 'pursuit',
        label: quest.chainTitle,
        detail: `${progress.value}/${progress.target} · +${Math.round(PURSUIT_BONUS * 100)}%`,
      });
    }
  }

  return out.slice(0, 2);
}

/**
 * The other direction: the habits that would move a given commitment.
 *
 * Used by the Ascent so a trial can name the row you are meant to tap rather
 * than describing a metric.
 */
export function habitsFor(type, args, state = getState()) {
  return state.habits.filter((hab) => !hab.archived && habitFeeds(hab, type, args || {}));
}

/** One line naming today's concrete move for a commitment, or null. */
export function todaysMove(type, args, state = getState()) {
  const list = habitsFor(type, args, state);
  if (!list.length) return null;
  if (list.length === 1) return list[0].title;
  return `${list[0].title} +${list.length - 1} more`;
}

/**
 * Whether anything at all is committed to, so Today can skip the strip
 * entirely rather than rendering an empty frame.
 */
export function hasCampaign(camp) {
  return !!(camp.trial || camp.pursuit);
}
