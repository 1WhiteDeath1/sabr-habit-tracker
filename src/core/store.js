// store.js — the one place that owns application state.
// Nothing else touches localStorage. Views read via `state`, write via `mutate`,
// and re-render because they subscribed. That is the whole contract.

import { defaultState, SCHEMA_VERSION, STORAGE_KEY, makeProfile, makeSettings, makeRecovery, makeGame, makeLedger, makeAcademics } from './schema.js';

let state = defaultState();
const listeners = new Set();
let saveTimer = null;
let booted = false;

/** Migrations run in order; each takes the old object and returns the new one.
 *  Key is the version being upgraded FROM. */
const MIGRATIONS = {
  // 0: (old) => ({ ...old, version: 1, newField: [] }),
};

function migrate(raw) {
  let s = raw;
  let guard = 0;
  while ((s.version || 0) < SCHEMA_VERSION && guard++ < 50) {
    const from = s.version || 0;
    const fn = MIGRATIONS[from];
    if (!fn) { s.version = SCHEMA_VERSION; break; }
    s = fn(s);
    if ((s.version || 0) <= from) { s.version = from + 1; }
  }
  return s;
}

/** Fill in anything a saved state is missing, so an older save never crashes a
 *  newer build. Shallow-merges the object-shaped roots against their factories. */
function reconcile(s) {
  const base = defaultState();
  const out = { ...base, ...s };
  out.profile  = { ...makeProfile(),  ...(s.profile  || {}) };
  out.settings = { ...makeSettings(), ...(s.settings || {}) };
  out.recovery = { ...makeRecovery(), ...(s.recovery || {}) };
  out.ledger   = { ...makeLedger(),   ...(s.ledger   || {}) };
  out.ledger.entries = Array.isArray(s.ledger?.entries) ? s.ledger.entries : [];
  out.academics = { ...makeAcademics(), ...(s.academics || {}) };
  out.academics.semester   = { ...makeAcademics().semester, ...(s.academics?.semester || {}) };
  out.academics.courses    = Array.isArray(s.academics?.courses) ? s.academics.courses : [];
  out.academics.tasks      = Array.isArray(s.academics?.tasks) ? s.academics.tasks : [];
  out.academics.history    = Array.isArray(s.academics?.history) ? s.academics.history : [];
  out.academics.study      = Array.isArray(s.academics?.study) ? s.academics.study : [];
  out.academics.weekBonuses = Array.isArray(s.academics?.weekBonuses) ? s.academics.weekBonuses : [];
  out.academics.attendance = (s.academics?.attendance && typeof s.academics.attendance === 'object') ? s.academics.attendance : {};
  out.game     = { ...makeGame(),     ...(s.game     || {}) };
  out.game.attrXp = { ...makeGame().attrXp, ...(s.game?.attrXp || {}) };
  out.game.offers = { ...makeGame().offers, ...(s.game?.offers || {}) };
  // Drop malformed receipts rather than letting one bad entry poison the wallet
  // — a NaN cost here would silently swallow the whole balance.
  out.game.owned = (Array.isArray(s.game?.owned) ? s.game.owned : [])
    .filter((e) => e && typeof e.id === 'string' && Number.isFinite(Number(e.cost)));
  out.settings.manualPrayers = { ...makeSettings().manualPrayers, ...(s.settings?.manualPrayers || {}) };
  out.habits  = Array.isArray(s.habits)  ? s.habits  : [];
  out.reviews = Array.isArray(s.reviews) ? s.reviews : [];
  out.comebacks = Array.isArray(s.comebacks) ? s.comebacks : [];
  out.stake = { ...base.stake, ...(s.stake || {}) };
  out.notifications = { day: null, dismissed: [], ...(s.notifications || {}) };
  out.notifications.dismissed = Array.isArray(out.notifications.dismissed) ? out.notifications.dismissed : [];
  out.logs    = (s.logs    && typeof s.logs    === 'object') ? s.logs    : {};
  out.journal = (s.journal && typeof s.journal === 'object') ? s.journal : {};
  out.focus   = { sessions: [], tasks: [], ...(s.focus || {}) };
  return out;
}

export function load() {
  if (booted) return state;
  booted = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = reconcile(migrate(JSON.parse(raw)));
  } catch (err) {
    console.error('[store] could not read saved state, starting fresh', err);
    try { localStorage.setItem(STORAGE_KEY + '.corrupt.' + Date.now(), localStorage.getItem(STORAGE_KEY) || ''); } catch (_) {}
    state = defaultState();
  }
  return state;
}

export function getState() { return state; }

/** Subscribe to every committed change. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('[store] listener failed', err); }
  }
}

/** Persist. Debounced, because taps can arrive faster than storage likes. */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}

export function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[store] save failed', err);
    document.dispatchEvent(new CustomEvent('sabr:save-failed', { detail: err }));
  }
}

/**
 * The only write path. `fn` receives a draft it may mutate in place.
 * Returning `false` aborts the change (no save, no re-render).
 */
export function mutate(fn, { silent = false } = {}) {
  const result = fn(state);
  if (result === false) return false;
  scheduleSave();
  if (!silent) notify();
  return true;
}

/** Replace everything — used by import and by "start over". */
export function replaceState(next) {
  state = reconcile(migrate(next));
  flush();
  notify();
}

export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'sabr' }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !('habits' in parsed)) {
    throw new Error('That file does not look like a Sabr backup.');
  }
  replaceState(parsed);
}

// Save on the way out — Android kills backgrounded tabs without warning.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}
