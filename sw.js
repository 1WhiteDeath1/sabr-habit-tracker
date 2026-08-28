/* sw.js — offline support.
 *
 * Strategy: precache the whole app shell on install (it is small and entirely
 * static), then serve navigations and same-origin assets cache-first with a
 * background refresh. The app has no server and no API, so there is nothing
 * that needs to be network-first — offline is the normal case, not the
 * exception, and the app must open on a phone in flight mode at 5am.
 */

const VERSION = 'sabr-v48';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/ui/styles.css',
  './src/ui/dom.js',
  './src/ui/icons.js',
  './src/ui/confetti.js',
  './src/ui/widgets.js',
  './src/main.js',
  './src/core/store.js',
  './src/core/schema.js',
  './src/core/dates.js',
  './src/core/game.js',
  './src/core/habits.js',
  './src/core/prayer.js',
  './src/core/quests.js',
  './src/core/recovery.js',
  './src/core/ledger.js',
  './src/core/academics.js',
  './src/core/horizons.js',
  './src/core/comeback.js',
  './src/core/stats.js',
  './src/core/upcoming.js',
  './src/core/audio.js',
  './src/core/economy.js',
  './src/core/stake.js',
  './src/core/streak.js',
  './src/core/trials.js',
  './src/core/ascend.js',
  './src/core/links.js',
  './src/data/trials.js',
  './src/core/unlocks.js',
  './src/data/unlocks.js',
  './src/features/vault.js',
  './src/ui/gate.js',
  './src/core/voice.js',
  './src/core/router.js',
  './src/core/notify.js',
  './src/data/library.js',
  './src/data/quests.js',
  './src/data/research.js',
  './src/data/scripture.js',
  './src/data/fast.js',
  './src/features/today.js',
  './src/features/habits.js',
  './src/features/quests.js',
  './src/features/shield.js',
  './src/features/sos.js',
  './src/features/focus.js',
  './src/features/night.js',
  './src/features/me.js',
  './src/features/onboarding.js',
  './src/features/tutorial.js',
  './src/features/coach.js',
  './src/features/comeback.js',
  './src/features/stats.js',
  './src/features/ledger.js',
  './src/features/uni.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll fails the whole install if any single file 404s, which would leave
    // the app with no offline copy at all. Add them individually instead.
    await Promise.all(SHELL.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] could not precache', url, err); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the shell, so any #/route works offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      if (cached) {
        refresh(req);
        return cached;
      }
      try { return await fetch(req); }
      catch (_) { return new Response('Offline and no cached copy available.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) { refresh(req); return cached; }
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});

/** Quietly pull a fresh copy into the cache for next time. */
function refresh(req) {
  fetch(req).then(async (res) => {
    if (res && res.ok) (await caches.open(VERSION)).put(req, res);
  }).catch(() => { /* offline — the cached copy stands */ });
}

self.addEventListener('notificationclick', (event) => {
  const { action } = event;
  const data = event.notification.data || {};
  event.notification.close();

  // "Ten minutes" re-arms the same alarm without waking the app at all. The
  // page may well be gone by now, and a snooze that needs the page open is not
  // a snooze.
  if (action === 'snooze') {
    event.waitUntil(new Promise((resolve) => {
      setTimeout(() => {
        self.registration.showNotification(event.notification.title, {
          body: event.notification.body,
          tag: event.notification.tag,
          data,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          requireInteraction: true,
          renotify: true,
          vibrate: [140, 70, 140, 70, 260],
          actions: [
            { action: 'done', title: 'Mark done' },
            { action: 'snooze', title: 'Ten minutes' },
          ],
        }).then(resolve, resolve);
      }, 10 * 60 * 1000);
    }));
    return;
  }

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Marking done needs the page, because the page owns the store. Tell
    // whichever window exists; if none does, open one and it will pick the
    // message up on boot.
    for (const client of all) {
      if ('focus' in client) {
        if (action === 'done' && data.habitId) {
          client.postMessage({ type: 'habit-action', action, habitId: data.habitId, day: data.day });
        }
        return client.focus();
      }
    }
    const url = action === 'done' && data.habitId
      ? `./index.html#/today?do=${encodeURIComponent(data.habitId)}`
      : './index.html#/today';
    return self.clients.openWindow(url);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
