// confetti.js — the level-up celebration.
//
// Canvas rather than DOM nodes: ninety animating elements would thrash layout
// on a phone, and a single canvas costs one composite. No library — this is
// about sixty lines of physics and the app has no dependencies to keep.
//
// The palette is the app's own, so the burst looks like it belongs to the thing
// that fired it rather than like a party horn bolted on.

const COLOURS = [
  '#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff', '#00cd9c', '#ff4b4b',
];

/** Someone who has asked for less motion gets a still moment, not a shower. */
function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fire a burst.
 *
 * `origin` is in viewport fractions. Defaults to slightly above centre, which
 * is where the level-up card sits — confetti should fall past the thing being
 * celebrated, not from the top of an empty screen.
 */
export function confetti({
  count = 90,
  spread = 1.15,
  power = 13,
  origin = { x: 0.5, y: 0.42 },
  duration = 3200,
} = {}) {
  if (reducedMotion()) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.appendChild(canvas);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  const size = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };
  size();
  window.addEventListener('resize', size);

  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return () => {}; }
  ctx.scale(dpr, dpr);

  const ox = w * origin.x;
  const oy = h * origin.y;

  // Fired upward and outward in a fan, then gravity does the rest. Each piece
  // gets its own tumble speed so the burst never looks like one rigid sheet.
  const bits = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread * 2;
    const speed = power * (0.55 + Math.random() * 0.75);
    return {
      x: ox + (Math.random() - 0.5) * 40,
      y: oy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.34,
      tilt: Math.random() * Math.PI,
      tiltSpin: 0.06 + Math.random() * 0.1,
      colour: COLOURS[(Math.random() * COLOURS.length) | 0],
      ribbon: Math.random() < 0.25,
    };
  });

  const GRAVITY = 0.42;
  const DRAG = 0.988;
  const start = performance.now();
  let raf = 0;
  let done = false;

  function stop() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    canvas.remove();
  }

  function frame(now) {
    const t = now - start;
    const life = Math.min(1, t / duration);
    ctx.clearRect(0, 0, w, h);

    let visible = 0;
    for (const b of bits) {
      b.vy += GRAVITY;
      b.vx *= DRAG;
      b.vy *= DRAG;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.spin;
      b.tilt += b.tiltSpin;

      if (b.y - 40 > h) continue;
      visible += 1;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      // Squashing the height by the tilt fakes the piece turning edge-on,
      // which is most of what makes paper read as paper.
      ctx.scale(1, Math.cos(b.tilt));
      ctx.globalAlpha = life > 0.75 ? 1 - (life - 0.75) / 0.25 : 1;
      ctx.fillStyle = b.colour;
      if (b.ribbon) ctx.fillRect(-b.w / 4, -b.h / 2, b.w / 2, b.h * 1.5);
      else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }

    if (!visible || life >= 1) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  // rAF never fires in a hidden tab, so nothing would clean this up on its own.
  setTimeout(stop, duration + 1500);

  return stop;
}
