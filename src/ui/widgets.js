// widgets.js — fragments shared by more than one screen.
// If two screens render the same thing, it lives here, so they cannot drift.

import { h, raw, esc, bar, ring, pill } from './dom.js';
import { getState } from '../core/store.js';
import { playerLevel, rankFor, attrSummary, comboMultiplier } from '../core/game.js';
import { nextRewardAfter } from '../core/unlocks.js';
import { CATEGORIES, STATUS, ATTRS, CATEGORY_ATTR, XP } from '../core/schema.js';
import { DIFFICULTY, payoutFor } from '../core/economy.js';
import { streakOf, statusOf, atRisk, weeklyRemaining } from '../core/habits.js';
import { icon } from './icons.js';
import { isEasy } from '../core/comeback.js';
import { habitLinks } from '../core/links.js';
import { prettyTime } from '../core/dates.js';
import { RESEARCH } from '../data/research.js';
import { themeOf } from '../data/quests.js';
import { sideStatus } from '../core/quests.js';

/**
 * Level + XP bar. Ranks are flavour, not a second progression system, so they
 * appear on the Me screen and nowhere else — pass { rank: true } there. Every
 * other caller gets the distance to the next level in that slot instead, which
 * is at least actionable.
 */
export function heroCard(state = getState(), { rank = false } = {}) {
  const lv = playerLevel(state);
  const r = rank ? rankFor(lv.level) : null;
  // A level number on its own answers nothing. The reward it is heading toward
  // is the only thing that makes the bar worth filling, so it goes on the bar.
  const next = nextRewardAfter(lv.level);
  return h`
    <div class="hero">
      <div class="hero__level">
        <div class="hero__lvlnum">${lv.level}</div>
        <div class="grow">
          <div class="hero__rank">${r ? r.name : 'Level ' + lv.level}</div>
          <div class="hero__meaning">${r ? r.meaning : `${lv.need - lv.into} XP to level ${lv.level + 1}`}</div>
        </div>
        <div class="mono muted" style="font-size:.78rem">${lv.into} / ${lv.need}</div>
      </div>
      <div style="margin-top:11px">${bar(lv.pct, { color: 'var(--accent)' })}</div>
      ${next ? raw(h`
        <div class="hero__next">
          ${icon(next.icon, { size: 15 })}
          <span class="grow">${next.label}</span>
          <span>level ${next.level}</span>
        </div>`) : raw('')}
    </div>`;
}

/** The five attributes with their levels. */
export function attrStrip(state = getState()) {
  const attrs = attrSummary(state);
  return h`
    <div class="attrgrid">
      ${attrs.map((a) => raw(h`
        <div class="attr">
          <div class="attr__icon">${icon(a.icon, { size: 22 })}</div>
          <div class="attr__lvl" style="color:${raw(a.color)}">${a.level}</div>
          <div class="attr__name">${a.label}</div>
          ${bar(a.pct, { color: a.color, height: 4 })}
        </div>`))}
    </div>`;
}

/**
 * One habit row. `variant` 'today' shows the check control; 'manage' shows a
 * chevron for editing. Both share the same title/meta block so the two screens
 * always describe a habit identically.
 */
export function habitRow(habit, key, { variant = 'today', state = getState(), camp = null } = {}) {
  const status = statusOf(state, key, habit.id);
  const streak = streakOf(habit, state, key);
  const risk = variant === 'today' && atRisk(habit, state, key);
  const color = CATEGORIES[habit.category]?.color || 'var(--accent)';
  const weekly = weeklyRemaining(habit, state, key);
  // While a habit is in easy mode the row has to say what it is actually asking
  // for. Showing the full title over a reduced target is how you stop trusting
  // the row, and the row is the only thing this app really has.
  const easy = isEasy(habit, key);

  // The rank the habit was bought at, carried onto the row. A day made of one
  // Diamond and three Bronze should look like that — objectives that are not
  // worth the same should not be drawn the same, which is the whole reason a
  // list of tasks feels flatter than a set of them.
  const tier = DIFFICULTY[habit.difficulty] || DIFFICULTY[2];
  const worth = Math.round(payoutFor(habit.difficulty).full * comboMultiplier(streak));
  // What this row is feeding, if anything. Only the caller that has already
  // measured the campaign passes it; everywhere else the row stays plain.
  const links = camp && variant === 'today' ? habitLinks(habit, camp) : [];

  const cls = [
    'habitrow',
    `metal--${tier.metal}`,
    status === STATUS.DONE ? 'is-done' : '',
    status === STATUS.PARTIAL ? 'is-partial' : '',
    status === STATUS.SKIP ? 'is-skip' : '',
    risk ? 'is-risk' : '',
    easy ? 'is-easy' : '',
  ].filter(Boolean).join(' ');

  const mark = icon(status === STATUS.PARTIAL ? 'half' : status === STATUS.SKIP ? 'minus' : 'check', { size: 19, cls: 'ico--bold' });

  const meta = [];
  if (easy && habit.tiny) meta.push({ ico: 'sprout', text: `easy \u00b7 ${habit.tiny}` });
  if (streak > 0) meta.push({ ico: 'flame', text: String(streak) });
  if (weekly != null) meta.push(weekly > 0 ? `${weekly} left this week` : 'week complete');
  if (habit.anchorPrayer) meta.push(`after ${habit.anchorPrayer}`);
  if (risk && !easy) meta.push('missed yesterday — do the 2-min version');

  const control = variant === 'today'
    ? h`<button class="habitrow__check" data-act="toggle" data-id="${habit.id}"
          aria-label="Mark ${habit.title} done" style="--habit-color:${raw(color)}">${mark}</button>`
    : habit.emoji
      ? h`<span class="habitrow__icon habitrow__icon--e">${habit.emoji}</span>`
      : h`<span class="habitrow__icon">${icon(CATEGORIES[habit.category]?.icon || 'check', { size: 20 })}</span>`;

  return h`
    <div class="${raw(cls)}" style="--habit-color:${raw(color)}" data-habit="${habit.id}">
      ${raw(control)}
      <div class="habitrow__main" data-act="${variant === 'today' ? 'detail' : 'edit'}" data-id="${habit.id}">
        <span class="habitrow__title">${habit.emoji && variant === 'today'
          ? raw(`<span class="habitrow__te">${habit.emoji}</span>`) : raw('')}${habit.title}</span>
        ${variant === 'today' && status !== STATUS.DONE && status !== STATUS.SKIP
        ? raw(h`<span class="habitrow__worth">+${worth}</span>`) : raw('')}
      ${links.length ? raw(h`<span class="habitrow__links">${links.map((l) => raw(h`
        <span class="hlink hlink--${raw(l.kind)} ${l.urgent ? 'is-urgent' : ''}">
          ${icon(l.kind === 'trial' ? 'flame' : 'target', { size: 11 })}${l.label}<i>${l.detail}</i>
        </span>`))}</span>`) : raw('')}
      ${meta.length ? raw(h`<span class="habitrow__meta">${meta.map((m) => raw(
          typeof m === 'string'
            ? `<span>${esc(m)}</span>`
            : `<span>${icon(m.ico, { size: 13 })}${esc(m.text)}</span>`))}</span>`) : raw('')}
      </div>
      ${variant === 'manage' ? raw('<span class="listrow__chev">›</span>') : raw('')}
    </div>`;
}

/** A Qur'an or hadith passage, respecting the Arabic setting. */
export function passageCard(p, { state = getState(), compact = false } = {}) {
  if (!p) return '';
  const showAr = state.settings.arabic && p.ar;
  return h`
    <div class="ayah">
      ${showAr ? raw(h`<div class="ayah__ar">${p.ar}</div>`) : raw('')}
      <div class="ayah__en">${p.en}</div>
      <div class="ayah__ref">${p.ref}${p.source === 'hadith' ? ' · hadith' : ''}</div>
      ${!compact && p.note ? raw(h`<div class="ayah__en muted" style="margin-top:6px;font-size:.82rem">${p.note}</div>`) : raw('')}
    </div>`;
}

/** "Why this works" card, driven by a key into data/research.js. */
export function evidenceCard(key, { full = false } = {}) {
  const r = RESEARCH[key];
  if (!r) return '';
  return h`
    <div class="evidence">
      <div class="evidence__title">${icon('flask', { size: 16 })} ${r.title}</div>
      <div>${full ? r.detail : r.claim}</div>
      <div class="evidence__cite">${r.cite}</div>
    </div>`;
}

/** Progress ring plus done/total, used in the Today header. */
export function dayRing(progress) {
  return h`
    <div class="row" style="gap:14px">
      ${ring(progress.pct, { size: 62, stroke: 6, label: `${progress.done}/${progress.total}` })}
      <div class="grow">
        <div style="font-weight:650">${labelForProgress(progress)}</div>
        <div class="muted" style="font-size:.82rem">${progress.total === 0 ? 'Nothing scheduled yet' : `${Math.round(progress.pct * 100)}% of today`}</div>
      </div>
    </div>`;
}

function labelForProgress(p) {
  if (p.total === 0) return 'No habits yet';
  if (p.done === 0) return 'The day is open';
  if (p.done === p.total) return 'Day complete';
  if (p.pct >= 0.6) return 'Nearly there';
  return 'In progress';
}

/** Time-of-day divider used on the Today list. */
export function timeGroup(label, minutes) {
  return h`
    <div class="timegroup">
      <span class="timegroup__label">${label}</span>
      ${minutes != null ? raw(h`<span class="timegroup__time">${prettyTime(minutes)}</span>`) : raw('')}
    </div>`;
}

export function attrColorFor(category) {
  return ATTRS[CATEGORY_ATTR[category] || 'aql']?.color || 'var(--accent)';
}

export { pill };

/**
 * A side-quest card. Lives here rather than on a screen because both Today and
 * Quests render it, and two copies would eventually disagree.
 */
export function sideQuestCard(q, state = getState()) {
  const status = sideStatus(q.id, state);
  const theme = themeOf(q);
  const cls = status === 'done' ? 'sidequest is-done'
    : status === 'accepted' ? 'sidequest is-accepted'
    : 'sidequest';

  return h`
    <div class="${raw(cls)}">
      <div class="row" style="align-items:flex-start;gap:11px">
        <span class="sq__icon">${icon(theme.icon, { size: 22 })}</span>
        <div class="grow">
          <!-- The same glyph already sits in .sq__icon beside this. Two subtle
               duotone SVGs read as one motif; two emoji read as a mistake. -->
          <span class="pill pill--${raw(theme.tone)}">${theme.label}</span>
          <div style="font-weight:800;font-size:1rem;margin-top:6px">${q.title}</div>
          <div class="dim" style="font-size:.87rem;margin-top:3px;line-height:1.45;font-weight:500">${q.desc}</div>
          <div class="sidequest__why">${q.why}</div>
        </div>
      </div>
      <div class="row" style="margin-top:13px;gap:8px">
        ${status === 'done'
          ? raw(`<span class="pill pill--accent">${icon('check', { size: 13 })} Done · +40 XP</span>`)
          : raw(h`
            ${status === 'accepted' ? raw('<span class="pill pill--violet">Accepted</span>') : raw(h`<button class="btn btn--ghost btn--sm" data-act="accept" data-id="${q.id}">Accept</button>`)}
            <span class="grow"></span>
            <button class="btn btn--primary btn--sm" data-act="complete" data-id="${q.id}">Mark done</button>`)}
      </div>
    </div>`;
}
