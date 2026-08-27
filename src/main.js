// main.js — boot sequence and the app shell.

import { load, getState, subscribe, mutate, flush } from './core/store.js';
import { register, setOutlet, setNotFound, start, onRouteChange, parse, go, refresh } from './core/router.js';
import { setHaptics, haptic, toast, sheet, raw } from './ui/dom.js';
import { levelFromXp, rankFor } from './core/game.js';
import { claimableCount } from './core/quests.js';
import { creditCleanDay } from './core/recovery.js';
import { initNotifications } from './core/notify.js';
import { initAudio, setSound, sfx } from './core/audio.js';
import { accrue } from './core/stake.js';
import { settleRukhsah, settleStreak, streakNow } from './core/streak.js';
import { confetti } from './ui/confetti.js';
import { todayKey } from './core/dates.js';

import { todayScreen } from './features/today.js';
import { habitsScreen } from './features/habits.js';
import { questsScreen } from './features/quests.js';
import { shieldScreen } from './features/shield.js';
import { focusScreen } from './features/focus.js';
import { meScreen } from './features/me.js';
import { nightScreen } from './features/night.js';
import { onboardingScreen } from './features/onboarding.js';
import { ledgerScreen } from './features/ledger.js';
import { tutorialScreen, tutorialPending } from './features/tutorial.js';
import { startCoach, coachPending } from './features/coach.js';
import { comebackScreen } from './features/comeback.js';
import { comebackDue } from './core/comeback.js';
import { upcoming, badgeCount } from './core/upcoming.js';
import { icon } from './ui/icons.js';
import { uniScreen } from './features/uni.js';
import { vaultScreen } from './features/vault.js';
import { adoptExisting, opensAtLevel, refundRetired } from './core/unlocks.js';
import { UNLOCKS, UNLOCK_ORDER } from './data/unlocks.js';
// Imported, not mirrored: main.js kept its own copy of the slot thresholds,
// so changing them in one place silently disagreed with the other.
import { SLOT_LEVELS, slotsAtLevel } from './core/comeback.js';
import { tierOpenedAt, DIFFICULTY, DIFFICULTY_ORDER } from './core/economy.js';
import { wallet } from './core/economy.js';

/* --------------------------------------------------------------- icons */
/* Inline SVG rather than emoji: emoji render differently on every device and
   never look like app chrome. These inherit currentColor. */

/**
 * The navigation glyphs.
 *
 * Wrapped in a sized span for the same reason core icons are: emoji advance
 * widths differ per platform, and an unboxed one makes the whole tab bar
 * jitter between devices.
 */
const G = (ch, size) => `<span class="ico ico--e" aria-hidden="true" style="width:${size}px;height:${size}px;font-size:${(size * 0.86).toFixed(1)}px">${ch}</span>`;

const ICON = {
  today:  G('\u{2600}\u{FE0F}', 26),
  quests: G('\u{1F3C6}', 26),
  me:     G('\u{1F464}', 28),
  uni:    G('\u{1F393}', 26),
  shield: G('\u{1F6E1}\u{FE0F}', 26),
  flame:  G('\u{1F525}', 17),
  bolt:   G('\u{26A1}', 17),
  star:   G('\u{2B50}', 17),
};

/* Five slots, and the middle one is you.
   The count has to be odd for a centre to exist at all, so Focus gives up its
   tab and is launched from Today instead — its routes are unchanged. */
const TABS = [
  { id: 'today',  label: 'Today',  color: 'var(--green)',  soft: 'var(--green-soft)' },
  { id: 'quests', label: 'Quests', color: 'var(--gold)',   soft: 'var(--gold-soft)' },
  { id: 'me',     label: 'Me',     color: 'var(--orange)', soft: 'var(--orange-soft)', centre: true },
  { id: 'uni',    label: 'Uni',    color: 'var(--teal)',   soft: 'var(--teal-soft)' },
  { id: 'shield', label: 'Shield', color: 'var(--purple)', soft: 'var(--purple-soft)' },
];

function boot() {
  const state = load();

  applyTheme(state);
  setHaptics(state.settings.haptics);
  setSound(state.settings.sound !== false);
  initAudio();

  register('today',   todayScreen);
  register('habits',  habitsScreen);
  register('quests',  questsScreen);
  register('shield',  shieldScreen);
  register('focus',   focusScreen);
  register('me',      meScreen);
  register('night',   nightScreen);
  register('welcome', onboardingScreen);
  register('tutorial', tutorialScreen);
  register('return',   comebackScreen);
  register('ledger',  ledgerScreen);
  register('uni',     uniScreen);
  register('vault',   vaultScreen);
  setNotFound(todayScreen);

  setOutlet(document.getElementById('outlet'));
  buildNav();
  onRouteChange(paintNav);

  // First run goes straight to onboarding and cannot be routed past it.
  if (!state.profile.onboarded && parse().name !== 'welcome') {
    location.replace('#/welcome');
  } else if (tutorialPending(state) && !state.habits.length && parse().name === 'today') {
    // Quit part-way through the cards on a fresh install? Pick them back up.
    // Anyone who already has habits is past needing it and is left alone —
    // they can reopen it from Settings.
    location.replace('#/tutorial');
  } else if (comebackDue(state) && parse().name === 'today') {
    // Two days off or more. This lands before anything else, because the whole
    // point is to catch the moment where the app usually gets abandoned.
    location.replace('#/return');
  } else if (coachPending(state) && parse().name === 'today') {
    // Cards done, pointing not. Run it once the first paint has landed.
    setTimeout(startCoach, 400);
  }

  start();

  // Once-a-day housekeeping, done quietly on open.
  mutate((s) => { s.lastOpened = Date.now(); }, { silent: true });
  creditCleanDay();
  // Anything already in use before modules had a price is kept, free, once.
  // An update must never take a working feature off someone mid-streak.
  adoptExisting();
  // Anything that has since been made free hands its XP back automatically.
  refundRetired();

  rolloverCheck();
  // Bring the stake ledger up to date once per launch. Only fully finished days
  // are ever counted, so today is never charged while it can still be fixed.
  try { accrue(); } catch (_) { /* a broken stake must not stop the app booting */ }
  // Order matters: concessions are spent against missed days FIRST, so that a
  // day a rukhsah covers never registers as a break at all. Settling the other
  // way round would show someone the "your run ended" card and then quietly
  // un-end it, which is worse than either outcome on its own.
  try { settleRukhsah(); settleStreak(); } catch (_) { /* never block boot */ }

  subscribe(() => paintNav(parse()));
  wireLevelUp();
  wireQuestToast();
  registerServiceWorker();
  initNotifications();
  wireInstallPrompt();

  document.getElementById('splash')?.remove();
}

function applyTheme(state) {
  const dark = state.settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#131f24' : '#ffffff';
}

/* ------------------------------------------------------------------ nav */

function buildNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map((t) => `
    <a href="#/${t.id}" data-tab="${t.id}" aria-label="${t.label}"
       class="${t.centre ? 'nav__centre' : ''}"
       style="--tab-color:${t.color};--tab-soft:${t.soft}">
      ${t.centre ? '<span class="nav__disc">' + ICON[t.id] + '</span>' : ICON[t.id]}
      <span class="nav__label">${t.label}</span>
      <span class="badge hidden" data-badge="${t.id}"></span>
    </a>`).join('');
  nav.addEventListener('click', () => haptic(6));
  paintNav(parse());
}

function paintNav(route) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onboarding = route.name === 'welcome' || route.name === 'tutorial' || route.name === 'return';
  nav.classList.toggle('hidden', onboarding);

  // "habits" and "night" live under Today; keep that tab lit while you are in them.
  const activeTab = ({ habits: 'today', night: 'today', ledger: 'today', focus: 'today' })[route.name] || route.name;
  for (const a of nav.querySelectorAll('[data-tab]')) {
    a.classList.toggle('is-active', a.dataset.tab === activeTab);
  }

  const claimable = claimableCount();
  const badge = nav.querySelector('[data-badge="quests"]');
  if (badge) {
    badge.textContent = String(claimable);
    badge.classList.toggle('hidden', claimable === 0);
  }

  paintTopbar(route);
}

/**
 * The running totals strip along the top: day streak, XP, clean days, level.
 * Always visible on the main tabs, because the whole point of a counter is that
 * you see it without going looking for it.
 */
function paintTopbar(route) {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  if (route.name === 'welcome' || route.name === 'tutorial' || route.name === 'return') {
    bar.classList.add('hidden'); return;
  }
  bar.classList.remove('hidden');

  const state = getState();
  const lv = levelFromXp(state.game.xp);
  // The chip shows what is FREE, not what is earned. Lifetime XP only ever goes
  // up, so as a headline it stops meaning anything after a fortnight; the free
  // balance is the number that changes when you make a decision, and it is the
  // one every priced thing in the app is measured against. The full arithmetic
  // is one tap away in the Vault.
  const w = wallet(state);

  // This used to say a streak had no place up here, and that was right while
  // the only streaks were per-habit: an app-wide average of chains already
  // visible on the rows summarised nothing. core/streak.js is a real day-level
  // run, so it earns the slot. It is shown small and next to nothing else —
  // the number that matters is the lifetime total on Today, and this chip is a
  // way back to it rather than the headline itself.
  const run = streakNow(state);
  const alerts = badgeCount(state);

  bar.innerHTML = `
    <button class="tb tb--xp${w.balance ? '' : ' is-zero'}" data-vault
            title="${w.balance} XP free of ${w.earned} earned — open the wallet">${ICON.bolt}${w.balance}</button>
    <div class="tb tb--level" title="Level">${ICON.star}${lv.level}</div>
    <button class="tb tb--streak${run ? '' : ' is-cold'}" data-streak
            title="${run} day run — your record is on Today">${icon('flame', { size: 17 })}${run}</button>
    <button class="tb tb--bell${alerts ? ' has-alerts' : ''}" data-bell aria-label="What is coming up">
      ${icon(alerts ? 'bell' : 'bellOff', { size: 23 })}
      ${alerts ? `<span class="tb__badge">${alerts > 9 ? '9+' : alerts}</span>` : ''}
    </button>`;

  bar.querySelector('[data-bell]')?.addEventListener('click', openUpcoming);
  bar.querySelector('[data-vault]')?.addEventListener('click', () => { haptic(8); go('vault'); });
  bar.querySelector('[data-streak]')?.addEventListener('click', () => { haptic(8); go('today'); });
}

/* ------------------------------------------------------- the bell panel */

/**
 * Everything with a date on it, in one sheet.
 *
 * A nudge, not an inbox: dismissals last until tomorrow, because an item that
 * is still true tomorrow should say so again rather than sit ticked off while
 * the attendance it warned about keeps sliding.
 */
function openUpcoming() {
  haptic(8);
  const state = getState();
  const list = upcoming(state);

  const body = list.length
    ? `<div class="stack-sm">${list.map((e) => `
        <a class="upc upc--${e.tone}" href="${e.href}" data-key="${e.key}">
          <span class="upc__ico">${icon(e.icon, { size: 19 })}</span>
          <span class="upc__text">
            <span class="upc__title">${escapeHTML(e.title)}</span>
            ${e.detail ? `<span class="upc__detail">${escapeHTML(e.detail)}</span>` : ''}
          </span>
          <button class="upc__x" data-dismiss="${e.key}" aria-label="Dismiss">${icon('close', { size: 14 })}</button>
        </a>`).join('')}</div>`
    : `<div class="empty"><div class="empty__icon">${icon('checkCircle', { size: 34 })}</div>
         <h3>Nothing waiting</h3>
         <p>No deadlines, no chains about to break, nothing to claim. Go and do today's habits.</p>
       </div>`;

  sheet({
    title: 'Coming up',
    body: raw(body),
    onMount: (el, close) => {
      el.addEventListener('click', (ev) => {
        const x = ev.target.closest('[data-dismiss]');
        if (x) {
          ev.preventDefault();
          ev.stopPropagation();
          dismissUpcoming(x.dataset.dismiss);
          x.closest('.upc')?.remove();
          paintTopbar(parse());
          return;
        }
        if (ev.target.closest('.upc')) close();
      });
    },
  });
}

function dismissUpcoming(key) {
  const today = todayKey();
  mutate((s) => {
    if (s.notifications.day !== today) s.notifications = { day: today, dismissed: [] };
    if (!s.notifications.dismissed.includes(key)) s.notifications.dismissed.push(key);
  }, { silent: true });
}

function escapeHTML(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* -------------------------------------------------------------- effects */

function wireLevelUp() {
  document.addEventListener('sabr:levelup', (ev) => {
    const level = ev.detail.newLevel;
    const opened = opensAtLevel(level);
    const slotNow = SLOT_LEVELS.includes(level);

    // The screen underneath is now stale — it was rendered against the old
    // level and is still showing the old slot count, the old shelf and the old
    // wallet. Refreshing here rather than on dismiss means the reward is
    // already in place behind the card, so closing it reveals the new state
    // instead of showing the old one for another beat.
    refresh();

    sfx('levelup');
    confetti();

    const rows = rewardRows(level, opened, slotNow);
    const overlay = document.createElement('div');
    overlay.className = 'levelup';
    overlay.innerHTML = `
      <div class="levelup__card">
        <div class="levelup__rays" aria-hidden="true"></div>
        <div class="levelup__badge">
          <span class="levelup__n">${level}</span>
        </div>
        <div class="levelup__eyebrow">Level up</div>
        <h1 class="levelup__h">${escapeHTML(rankFor(level).name)}</h1>
        <p class="levelup__rank">${escapeHTML(rankFor(level).meaning)}</p>
        ${rows}
        <button class="btn btn--primary btn--lg btn--block levelup__go">Continue</button>
      </div>`;
    document.body.appendChild(overlay);

    // Staggered reveal. Each row is handed its own delay as a custom property
    // rather than an inline animation, so the CSS owns the timing and a reader
    // with prefers-reduced-motion gets the whole thing at once.
    overlay.querySelectorAll('.lvrow').forEach((el, i) => {
      el.style.setProperty('--i', String(i));
    });

    haptic([30, 60, 30, 60, 30, 60, 120]);
    const dismiss = () => overlay.remove();
    overlay.addEventListener('click', dismiss);
    // Long enough for the last row to have landed and been read.
    setTimeout(dismiss, 6400);
  });
}

/**
 * What this level opened, and — when it opened nothing — what the next one
 * does.
 *
 * The empty case used to render nothing at all, so roughly two levels in three
 * produced a card that said "Level 7" and no more, which teaches a player that
 * levelling is decorative. Naming the next reward turns a flat level into a
 * step toward one.
 */
function rewardRows(level, opened, slotNow) {
  const rows = [];
  // A whole rank of the library opening is the biggest thing a level can do,
  // so it goes first.
  const tier = tierOpenedAt(level);
  if (tier) {
    rows.push(`<div class="lvrow lvrow--big"><span class="lvrow__e">${tier.emoji}</span>
      <span><strong>${escapeHTML(tier.label)} habits</strong><em>A new rank in the library · ${tier.cost} XP each</em></span></div>`);
  }
  if (slotNow) {
    const n = slotsAtLevel(level);
    rows.push(`<div class="lvrow lvrow--big">${icon('sprout', { size: 20 })}
      <span><strong>A ${ordinal(n)} habit slot</strong><em>You can hold ${n} habits now</em></span></div>`);
  }
  for (const d of opened) {
    rows.push(`<div class="lvrow">${icon(d.icon, { size: 20 })}
      <span><strong>${escapeHTML(d.label)}</strong><em>On the shelf for ${d.cost} XP</em></span></div>`);
  }

  if (rows.length) {
    return `<div class="lvrewards"><div class="lvrewards__k">Unlocked</div>${rows.join('')}</div>`;
  }

  const next = nextReward(level);
  if (!next) return '';
  return `<div class="lvrewards lvrewards--next">
    <div class="lvrewards__k">Next</div>
    <div class="lvrow">${next.emoji ? `<span class="lvrow__e">${next.emoji}</span>` : icon(next.icon, { size: 20 })}
      <span><strong>${escapeHTML(next.label)}</strong><em>at level ${next.level} · ${next.level - level} to go</em></span></div>
  </div>`;
}

/** The nearest thing still ahead of `level`, slot or module, whichever is first. */
function nextReward(level) {
  const tier = DIFFICULTY_ORDER.map((t) => DIFFICULTY[t]).find((d) => d.minLevel > level);
  const slot = SLOT_LEVELS.find((l) => l > level);
  const mod = UNLOCK_ORDER
    .map((id) => UNLOCKS[id])
    .filter((d) => d && d.level > level)
    .sort((a, b) => a.level - b.level)[0];
  const best = [
    tier && { level: tier.minLevel, emoji: tier.emoji, label: `${tier.label} habits` },
    slot && { level: slot, icon: 'sprout', label: `A ${ordinal(slotsAtLevel(slot))} habit slot` },
    mod && { level: mod.level, icon: mod.icon, label: mod.label },
  ].filter(Boolean).sort((a, b) => a.level - b.level)[0];
  return best || null;
}

function ordinal(n) {
  const names = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
                 'seventh', 'eighth', 'ninth', 'tenth'];
  return names[n] || `${n}th`;
}

function wireQuestToast() {
  document.addEventListener('sabr:quest-complete', (ev) => {
    const q = ev.detail.quest;
    if (q.kind === 'main') haptic([25, 60, 25, 60, 90]);
  });
}

/** Housekeeping for state that does not survive a day boundary cleanly. */
function rolloverCheck() {
  const active = getState().focus.active;
  // A focus block left running overnight was not a real session — drop it
  // rather than showing a 14-hour timer in the morning.
  if (active && Date.now() - active.startedAt > 6 * 3600000) {
    mutate((s) => { s.focus.active = null; }, { silent: true });
  }
}

/* ---------------------------------------------------------- PWA plumbing */

/** Localhost, unless ?sw=1 asks for the real thing. */
function isDevHost() {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    && !new URLSearchParams(location.search).has('sw');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // The precache is keyed on VERSION, so during development every edit needs a
  // manual bump or the worker keeps serving the copy it took at install time —
  // you change a file, reload, and get the old one with nothing to say why.
  // Skip it on localhost and unregister anything already installed there.
  // Append ?sw=1 to the URL when the offline behaviour is what you are testing.
  if (isDevHost()) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
    return;
  }

  const base = location.pathname.replace(/[^/]*$/, '');
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Update ready — reopen the app to apply', {});
          }
        });
      });
    })
    .catch((err) => console.warn('[sw] registration failed', err));
}

/**
 * Android fires beforeinstallprompt when the app qualifies for installation.
 * We stash it and show our own button, because the browser's own banner is
 * easy to miss and this is the step that turns a link into an app icon.
 */
function wireInstallPrompt() {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferred = ev;
    showInstallBar();
  });
  window.addEventListener('appinstalled', () => {
    document.getElementById('installbar')?.remove();
    toast('Installed. Open it from your home screen from now on.', { tone: 'good' });
  });

  function showInstallBar() {
    if (document.getElementById('installbar')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const bar = document.createElement('div');
    bar.id = 'installbar';
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + var(--safe-bottom) + 12px);z-index:60;background:var(--surface-3);border:1px solid var(--line-str);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;box-shadow:var(--shadow)';
    bar.innerHTML = `
      <div style="flex:1;min-width:0">
        <div style="font-weight:650;font-size:.9rem">Add Sabr to your home screen</div>
        <div style="font-size:.76rem;color:var(--muted)">Opens fullscreen and works offline</div>
      </div>
      <button class="btn btn--primary btn--sm" data-install>Install</button>
      <button class="iconbtn" data-dismiss aria-label="Dismiss">&times;</button>`;
    document.body.appendChild(bar);
    bar.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-dismiss]')) { bar.remove(); return; }
      if (ev.target.closest('[data-install]') && deferred) {
        bar.remove();
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
      }
    });
  }
}

/* -------------------------------------------------------------- failsafe */

window.addEventListener('error', (ev) => {
  console.error('[app] uncaught', ev.error || ev.message);
  flush();
});
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[app] unhandled rejection', ev.reason);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
