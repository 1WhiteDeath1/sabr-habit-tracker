// voice.js — twenty seconds of you, recorded on a good day.
//
// Written text gets read in the reader's own flat internal narrator, which is
// exactly the voice that is already losing the argument at the moment you need
// it. A recording is not read, it is heard, and it arrives with the conviction
// you had when you made it. It also cannot be dismissed as generic advice,
// because it is demonstrably you saying it.
//
// Stored in IndexedDB rather than localStorage: audio is far too big for a
// 5MB string store, and putting it there would risk the quota that holds every
// habit log in this app. It never leaves the device, and it is not included in
// the JSON backup for the same reason — a backup you might email should not
// carry your voice in it.

const DB = 'sabr.voice';
const STORE = 'clips';
const KEY = 'why';

export const MAX_SECONDS = 30;

function open() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('no indexeddb')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

/** Is recording even possible here? Checked before any button is offered. */
export function canRecord() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.indexedDB);
}

/** The best container this browser will give us. */
function mimeType() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

/**
 * Start recording. Returns a handle with stop() -> Blob and cancel().
 *
 * The caller owns the microphone permission prompt, which is why this throws
 * rather than swallowing: a silent failure would leave someone talking at a
 * button that was never listening.
 */
export async function record({ onTick } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = mimeType();
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();

  const started = Date.now();
  const timer = setInterval(() => {
    const secs = (Date.now() - started) / 1000;
    onTick?.(secs);
    if (secs >= MAX_SECONDS) stop();
  }, 200);

  const release = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
  };

  let settle;
  const finished = new Promise((res) => { settle = res; });
  rec.onstop = () => { release(); settle(new Blob(chunks, { type: type || 'audio/webm' })); };

  function stop() {
    if (rec.state !== 'inactive') rec.stop();
    return finished;
  }

  return {
    stop,
    cancel: () => { release(); if (rec.state !== 'inactive') rec.stop(); },
    seconds: () => (Date.now() - started) / 1000,
  };
}

export async function saveClip(blob) {
  await tx('readwrite', (store) => store.put({ blob, at: Date.now(), size: blob.size }, KEY));
}

export async function loadClip() {
  try { return (await tx('readonly', (store) => store.get(KEY))) || null; }
  catch (_) { return null; }
}

export async function deleteClip() {
  try { await tx('readwrite', (store) => store.delete(KEY)); } catch (_) { /* already gone */ }
}

export async function hasClip() {
  return !!(await loadClip());
}

/**
 * Play the saved clip. Returns the Audio element so a caller can stop it.
 * The object URL is revoked when playback ends, so nothing leaks.
 */
export async function playClip() {
  const rec = await loadClip();
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  const audio = new Audio(url);
  const done = () => { URL.revokeObjectURL(url); };
  audio.addEventListener('ended', done, { once: true });
  audio.addEventListener('error', done, { once: true });
  try { await audio.play(); } catch (_) { done(); return null; }
  return audio;
}
