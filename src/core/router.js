// router.js — hash routing. Hash rather than history API so the app works from
// any static host, any subdirectory, and from a home-screen shortcut.

const routes = new Map();
let current = null;
let outlet = null;
let notFound = null;
let onChange = null;

/** register('today', {render, mount, unmount, title}) */
export function register(name, screen) {
  routes.set(name, screen);
}

export function setOutlet(el) { outlet = el; }
export function setNotFound(fn) { notFound = fn; }
export function onRouteChange(fn) { onChange = fn; }

/** Parse "#/shield/sos?x=1" -> {name:'shield', params:['sos'], query:{x:'1'}} */
export function parse(hash = location.hash) {
  const clean = hash.replace(/^#\/?/, '');
  const [path, qs] = clean.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  return { name: parts[0] || 'today', params: parts.slice(1), query };
}

export function go(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\/+/, '')}`;
  if (location.hash === target) { render(); return; }
  if (replace) location.replace(target);
  else location.hash = target;
}

export function currentRoute() { return parse(); }

let rendering = false;
export function render() {
  if (!outlet || rendering) return;
  rendering = true;
  try {
    const route = parse();
    const screen = routes.get(route.name) || notFound;
    if (!screen) return;

    if (current && current.screen !== screen) current.screen.unmount?.(outlet);

    // Preserve scroll within a screen; reset when moving between screens.
    const sameScreen = current?.screen === screen;
    outlet.innerHTML = screen.render(route) || '';
    screen.mount?.(outlet, route);
    if (!sameScreen) outlet.scrollTop = 0;

    current = { screen, route };
    document.body.dataset.screen = route.name;
    onChange?.(route);
  } catch (err) {
    console.error('[router] render failed', err);
    outlet.innerHTML = `<div class="pad"><div class="card card--warn">
      <h3>Something broke on this screen</h3>
      <p class="muted">Your data is safe — it is stored separately from the screen that failed.</p>
      <pre class="errbox">${String(err && err.message || err)}</pre>
      <a class="btn btn--primary" href="#/today">Back to Today</a></div></div>`;
  } finally {
    rendering = false;
  }
}

/** Re-render the current screen in place (after a state change). */
export function refresh() { render(); }

export function start() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.replace('#/today');
  render();
}
