// dom.js — the small set of primitives every screen is built from.
// No framework. The rules: build HTML with the `h` tag (which escapes anything
// interpolated), and handle interaction with delegated [data-act] attributes.

/** Escape text for safe interpolation. Habit titles are user input. */
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Mark a string as already-safe HTML so `h` will not escape it. */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export function raw(s) { return new Raw(s); }

/** Escape a value unless it is already-safe HTML. For helpers that take either
 *  a plain string or an icon built by ui/icons.js. */
function html(v) { return v instanceof Raw ? v.s : esc(v); }

/** Tagged template that escapes every interpolation unless it is raw(). */
export function h(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += (v instanceof Raw) ? v.s
      : Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('')
      : esc(v);
    out += strings[i + 1];
  }
  return out;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Delegated action handler. Screens call `actions(root, {name: fn})` once;
 * any element with data-act="name" inside `root` calls it, with the element and
 * its dataset. Survives re-renders because it is bound to the container.
 */
/**
 * How far a finger may travel between touching down and lifting and still
 * count as a tap rather than as a scroll.
 *
 * On a phone the overwhelming cause of a habit being marked done by accident
 * is not a mis-aimed tap, it is a scroll that begins on top of a control: the
 * finger lands on a row, drags the list, lifts, and the browser still reports
 * a click because the start and end elements match. Twelve pixels is below
 * what anyone can hold still through a deliberate press and well under what a
 * real scroll covers.
 */
const TAP_SLOP = 12;

export function actions(root, map) {
  if (root.__actionsBound) {
    root.removeEventListener('click', root.__actionsBound);
    root.removeEventListener('pointerdown', root.__actionsDown);
  }

  let downX = 0;
  let downY = 0;
  let moved = false;
  const down = (ev) => {
    downX = ev.clientX; downY = ev.clientY; moved = false;
  };
  const move = (ev) => {
    if (Math.abs(ev.clientX - downX) > TAP_SLOP || Math.abs(ev.clientY - downY) > TAP_SLOP) moved = true;
  };

  const handler = (ev) => {
    const target = ev.target.closest('[data-act]');
    if (!target || !root.contains(target)) return;
    const fn = map[target.dataset.act];
    if (!fn) return;
    ev.preventDefault();
    // A click that arrived at the end of a drag is a scroll, not a decision.
    if (moved) { moved = false; return; }
    fn(target, target.dataset, ev);
  };

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('click', handler);
  root.__actionsBound = handler;
  root.__actionsDown = down;
}

/** Short vibration on meaningful taps. Silently ignored where unsupported. */
let hapticsEnabled = true;
export function setHaptics(on) { hapticsEnabled = !!on; }
export function haptic(pattern = 12) {
  if (!hapticsEnabled) return;
  try { navigator.vibrate?.(pattern); } catch (_) { /* not supported */ }
}

/* -------------------------------------------------------------- feedback */

let toastTimer = null;
/**
 * A toast, optionally with one action on it.
 *
 * The action exists for exactly one job: undoing something you have just done
 * by accident. It is deliberately a single button with no confirm — a misclick
 * that takes two more taps to reverse is a misclick you learn to live with.
 */
export function toast(message, { icon = '', tone = 'default', ms = 2200, action = null } = {}) {
  let host = $('#toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast';
    document.body.appendChild(host);
  }
  host.className = `toast toast--${tone} is-in`;
  host.innerHTML = h`${icon ? raw(`<span class="toast__icon">${html(icon)}</span>`) : raw('')}<span class="grow">${message}</span>${
    action ? raw(`<button class="toast__act">${esc(action.label)}</button>`) : raw('')}`;
  if (action) {
    host.querySelector('.toast__act').addEventListener('click', () => {
      host.classList.remove('is-in');
      clearTimeout(toastTimer);
      action.onClick();
    }, { once: true });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove('is-in'), ms);
}

/** Floating "+18 XP" that rises from where you tapped. Pure feedback, no state. */
export function xpBurst(amount, anchorEl, attrColor = 'var(--gold)') {
  if (!amount) return;
  const rect = anchorEl?.getBoundingClientRect?.();
  const node = document.createElement('div');
  node.className = 'xpburst';
  node.textContent = `+${Math.round(amount)} XP`;
  node.style.setProperty('--burst-color', attrColor);
  node.style.left = `${rect ? rect.left + rect.width / 2 : window.innerWidth / 2}px`;
  node.style.top = `${rect ? rect.top : window.innerHeight / 2}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

/* ----------------------------------------------------------------- sheet */

/**
 * Bottom sheet — the app's only modal pattern, because on a phone a sheet is
 * reachable with a thumb and a centred dialog is not.
 * Returns {close}. `onClose` fires for every dismissal route.
 */
export function sheet({ title = '', body = '', footer = '', onMount, onClose, size = 'auto' }) {
  const host = document.createElement('div');
  host.className = 'sheet-host';
  host.innerHTML = h`
    <div class="sheet__scrim" data-sheet-close></div>
    <section class="sheet sheet--${size}" role="dialog" aria-modal="true" aria-label="${title || 'Dialog'}">
      <div class="sheet__grip" data-sheet-close></div>
      ${title ? raw(`<header class="sheet__head"><h2>${esc(title)}</h2>
        <button class="iconbtn" data-sheet-close aria-label="Close">&times;</button></header>`) : raw('')}
      <div class="sheet__body">${raw(body)}</div>
      ${footer ? raw(`<footer class="sheet__foot">${footer}</footer>`) : raw('')}
    </section>`;
  document.body.appendChild(host);
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => host.classList.add('is-in'));

  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    host.classList.remove('is-in');
    document.body.classList.remove('is-locked');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => host.remove(), 240);
    onClose?.(result);
  };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  host.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-sheet-close]')) close();
  });

  onMount?.(host.querySelector('.sheet'), close);
  return { el: host.querySelector('.sheet'), close };
}

/** Yes/no confirmation as a sheet. Resolves true/false. */
export function confirmSheet({ title, message, confirmLabel = 'Confirm', tone = 'default' }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = sheet({
      title,
      body: h`<p class="prose">${message}</p>`,
      footer: h`
        <button class="btn btn--ghost" data-confirm="no">Cancel</button>
        <button class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" data-confirm="yes">${confirmLabel}</button>`,
      onClose: () => { if (!answered) resolve(false); },
      onMount: (el, close) => {
        el.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-confirm]');
          if (!btn) return;
          answered = true;
          resolve(btn.dataset.confirm === 'yes');
          close();
        });
      },
    });
    return s;
  });
}

/* ------------------------------------------------------------- fragments */

/** Progress ring as inline SVG. `pct` 0..1. */
export function ring(pct, { size = 64, stroke = 9, color = 'var(--accent)', label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return raw(`
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring__fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
              stroke="${color}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
      ${label ? `<text class="ring__label" x="50%" y="50%" dy=".35em" text-anchor="middle">${esc(label)}</text>` : ''}
    </svg>`);
}

/** Horizontal progress bar. */
export function bar(pct, { color = 'var(--accent)', height = 16 } = {}) {
  const p = Math.max(0, Math.min(1, pct || 0)) * 100;
  return raw(`<div class="bar" style="--bar-h:${height}px"><i style="width:${p.toFixed(1)}%;background:${color}"></i></div>`);
}

/**
 * A "?" disclosure.
 *
 * Explanatory copy is worth having and not worth reading every single day. Left
 * on the screen it becomes grey noise you scroll past, and it pushes the thing
 * you actually came to do further down. Behind a tap it costs nothing to the
 * person who already knows, and is still there for the person who does not.
 *
 * Built on <details> so it needs no JavaScript, no state, and no re-render
 * bookkeeping — the open/closed state belongs to the element, not to the app.
 */
export function qa(body) {
  return raw(`<details class="qa qa--dot"><summary aria-label="Explain"></summary>
    <div class="qa__body">${body instanceof Raw ? body.s : esc(body)}</div></details>`);
}

/**
 * A whole row as the tap target, with a "?" at its end.
 *
 * The row must be the <summary> rather than sitting beside a separate button:
 * a <details> placed inside a flex row becomes a flex item, and its body then
 * inherits that item's width instead of the card's.
 */
export function qaRow(label, body, { cls = '' } = {}) {
  return raw(`<details class="qa qa--row ${cls}"><summary>
      <span class="grow">${label instanceof Raw ? label.s : esc(label)}</span>
      <i class="qa__mark" aria-hidden="true">?</i>
    </summary>
    <div class="qa__body">${body instanceof Raw ? body.s : esc(body)}</div></details>`);
}

/** qaRow with the card's own title as the label. */
export function qaTitle(title, body) {
  return qaRow(raw(`<span class="card__title">${title instanceof Raw ? title.s : esc(title)}</span>`), body);
}

export function pill(text, { tone = 'default', icon = '' } = {}) {
  return raw(`<span class="pill pill--${tone}">${icon ? esc(icon) + ' ' : ''}${esc(text)}</span>`);
}

/** Empty-state block, used everywhere so blank screens still teach something. */
export function empty({ icon = null, title, body, actionLabel, action }) {
  return raw(h`
    <div class="empty">
      ${icon ? raw(`<div class="empty__icon">${html(icon)}</div>`) : raw('')}
      <h3>${title}</h3>
      <p>${body}</p>
      ${actionLabel ? raw(`<button class="btn btn--primary" data-act="${esc(action)}">${esc(actionLabel)}</button>`) : raw('')}
    </div>`);
}
