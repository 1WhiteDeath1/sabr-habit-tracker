// notify.js — reminders, with honest limits.
//
// What a home-screen web app can actually do on Android: show notifications
// while it is open or recently alive, and — on browsers that ship the
// Notification Triggers API — schedule a handful in advance through the service
// worker. What it cannot do is behave like a native alarm clock weeks out.
// The UI says so plainly rather than promising something that will fail at 5am.

import { getState } from './store.js';
import { dayPlan, statusOf } from './habits.js';
import { todayKey, minutesNow } from './dates.js';

const timers = new Set();

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

async function show(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const options = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', silent: false };
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
    if (at >= 24 * 60 || at <= now) continue;
    if (statusOf(state, key, habit.id)) continue;
    const delayMs = (at - now) * 60000;
    if (delayMs > 6 * 3600000) continue;   // beyond this, the tab will not survive anyway
    const t = setTimeout(() => {
      const fresh = getState();
      if (statusOf(fresh, key, habit.id)) return;   // already done in the meantime
      show(habit.title, habit.cue || habit.tiny || 'Time for this one.', `habit-${habit.id}`);
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
}
