// notify.js — reminders, with honest limits.
//
// What a home-screen web app can actually do on Android: show notifications
// while it is open or recently alive, and — on browsers that ship the
// Notification Triggers API — schedule a handful in advance through the service
// worker. What it cannot do is behave like a native alarm clock weeks out.
// The UI says so plainly rather than promising something that will fail at 5am.

import { getState, subscribe } from './store.js';
import { dayPlan, statusOf, scheduleOf } from './habits.js';
import { todayKey, minutesNow } from './dates.js';

const timers = new Set();

/**
 * How long before a scheduled habit the alarm goes off.
 *
 * Five minutes is the useful distance: long enough to stand up and stop what
 * you are doing, short enough that you have not forgotten by the time it
 * arrives. Firing exactly on the minute is the same as firing late.
 */
export const LEAD_MINUTES = 5;

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function triggersSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'showTrigger' in Notification.prototype;
}

export async function requestNotifications() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show one.
 *
 * `alarm` gives it the pager treatment: it stays on screen until dismissed
 * rather than fading, vibrates in a pattern you would notice in a pocket, and
 * carries actions so the habit can be ticked or pushed back without opening
 * the app. Ordinary nudges do none of that — if everything insists, nothing
 * does.
 */
async function show(title, body, tag, { alarm = false, data = null } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const options = {
      body, tag, data,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      silent: false,
      renotify: true,
      requireInteraction: alarm,
      vibrate: alarm ? [140, 70, 140, 70, 260] : [90],
      actions: alarm ? [
        { action: 'done', title: 'Mark done' },
        { action: 'snooze', title: 'Ten minutes' },
      ] : [],
    };
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch (err) {
    console.warn('[notify] could not show notification', err);
  }
}

function clearAll() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
}

/**
 * Schedule today's remaining reminders. Called on boot and whenever the app
 * comes back to the foreground, so the set stays current.
 */
export function scheduleToday() {
  clearAll();
  if (!notificationsSupported() || Notification.permission !== 'granted') return 0;

  const state = getState();
  const key = todayKey();
  const now = minutesNow();
  const { items } = dayPlan(state, key);
  let scheduled = 0;

  for (const { habit, at } of items) {
    if (at >= 24 * 60 || statusOf(state, key, habit.id)) continue;

    // Only habits you actually put a clock on get an alarm. A prayer anchor or
    // a slot places a habit in the list; it is not a time you asked to be
    // interrupted at, and treating it as one is how an app teaches you to turn
    // its notifications off altogether.
    const sched = scheduleOf(habit, key);
    const alarm = sched.at != null;
    const fireAt = alarm ? sched.at - LEAD_MINUTES : at;
    if (fireAt <= now) continue;

    const delayMs = (fireAt - now) * 60000;
    if (delayMs > 6 * 3600000) continue;   // beyond this the tab will not survive anyway
    const t = setTimeout(() => {
      const fresh = getState();
      if (statusOf(fresh, key, habit.id)) return;   // done in the meantime
      if (alarm) {
        show(`${habit.title} — in ${LEAD_MINUTES} minutes`,
          habit.cue || habit.tiny || 'Stand up for this one.',
          `habit-${habit.id}`, { alarm: true, data: { habitId: habit.id, day: key } });
      } else {
        show(habit.title, habit.cue || habit.tiny || 'Time for this one.', `habit-${habit.id}`);
      }
    }, delayMs);
    timers.add(t);
    scheduled += 1;
  }

  // Evening shutdown nudge.
  const sleepMins = parseTarget(state.settings.sleepTarget, 23 * 60);
  const nudgeAt = sleepMins - 60;
  if (nudgeAt > now && !state.journal[key]?.shutdown) {
    const t = setTimeout(() => {
      if (getState().journal[todayKey()]?.shutdown) return;
      show('Close the day', 'Shutdown ritual, then phone out of the room.', 'shutdown');
    }, (nudgeAt - now) * 60000);
    timers.add(t);
    scheduled += 1;
  }

  return scheduled;
}

function parseTarget(hm, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

export function initNotifications() {
  if (!notificationsSupported()) return;
  scheduleToday();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleToday(); });
  // Any change to a habit can move or remove an alarm, so the set is rebuilt
  // on every write rather than only when the tab is refocused. Debounced: a
  // single tick fans out several writes and rescheduling on each is wasteful.
  let pending = null;
  subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(scheduleToday, 400);
  });

  // Ticking a habit from the notification itself.
  navigator.serviceWorker?.addEventListener('message', (ev) => {
    if (ev.data?.type !== 'habit-action') return;
    document.dispatchEvent(new CustomEvent('sabr:notify-action', { detail: ev.data }));
  });
}
