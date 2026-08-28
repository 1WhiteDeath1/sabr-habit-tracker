// Static audit: find identifiers called as functions that are neither declared
// in the file nor imported into it. This is the exact bug class that took the
// Vault down — a call site updated, its import forgotten — and it is invisible
// to a route sweep unless the crashing branch happens to render.
import fs from 'fs';
import path from 'path';

const GLOBALS = new Set(`
window document navigator console location history localStorage sessionStorage indexedDB caches
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame queueMicrotask
fetch Promise Array Object String Number Boolean Math JSON Date RegExp Map Set WeakMap WeakSet Symbol
Error TypeError RangeError Intl Proxy Reflect BigInt parseInt parseFloat isNaN isFinite encodeURIComponent
decodeURIComponent structuredClone AbortController Blob File FileReader URL URLSearchParams FormData Image
Audio Notification MediaRecorder AudioContext OfflineAudioContext CustomEvent Event Request Response
PointerEvent KeyboardEvent MouseEvent TouchEvent IntersectionObserver ResizeObserver MutationObserver
performance crypto alert confirm prompt btoa atob TextEncoder TextDecoder Uint8Array Float32Array
ArrayBuffer DataView self globalThis clients skipWaiting addEventListener removeEventListener
if for while switch return function class new typeof instanceof delete void
try catch finally throw else do break continue case default super this async await yield import
constructor toString valueOf calc translate rotate scale
`.trim().split(/\s+/));

const BACKSLASH = String.fromCharCode(92);

/** Blank out comments and string bodies, keeping line numbering intact. */
function scrub(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      i += 2; out += '  '; continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; out += ' '; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === BACKSLASH) { out += '  '; i += 2; continue; }
        // ${...} interiors in a template are real code, so keep them
        if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1; out += '  '; i += 2;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            if (src[i] === '}') depth--;
            out += depth > 0 ? src[i] : ' ';
            i++;
          }
          continue;
        }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      out += ' '; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('src');
files.push('sw.js');

let issues = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const code = scrub(src);
  const declared = new Set();

  for (const m of src.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))\s*(?:,\s*\{([^}]*)\})?\s*from/g)) {
    for (const grp of [m[1], m[3]]) {
      if (!grp) continue;
      for (const part of grp.split(',')) {
        const nm = part.trim().split(/\s+as\s+/).pop().trim();
        if (nm) declared.add(nm);
      }
    }
    if (m[2]) declared.add(m[2]);
  }
  for (const m of code.matchAll(/\b(?:function|class)\s+(\w+)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const p of m[1].split(',')) declared.add(p.split(':').pop().split('=')[0].trim());
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const p of m[1].split(',')) declared.add(p.split('=')[0].trim());
  }
  for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) {
    for (const p of m[1].split(',')) declared.add(p.replace(/[{}[\].]/g, '').split(':').pop().split('=')[0].trim());
  }
  for (const m of code.matchAll(/\bfunction\s*\w*\s*\(([^)]*)\)/g)) {
    for (const p of m[1].split(',')) declared.add(p.replace(/[{}[\].]/g, '').split(':').pop().split('=')[0].trim());
  }
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(m[1]);
  for (const m of code.matchAll(/catch\s*\(\s*(\w+)/g)) declared.add(m[1]);
  // object method shorthand: `render() {`, `async mount(root) {`
  for (const m of code.matchAll(/(?:^|[,{]\s*)(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) declared.add(m[1]);

  const lines = code.split('\n');
  const missing = [];
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/g)) {
      const nm = m[2];
      if (declared.has(nm) || GLOBALS.has(nm)) continue;
      if (missing.some((x) => x[0] === nm)) continue;
      missing.push([nm, i + 1]);
    }
  }
  if (missing.length) {
    issues += missing.length;
    for (const [nm, ln] of missing) console.log(`${file}:${ln}  ${nm}(...)  -- not imported, not declared`);
  }
}
console.log(issues ? `\n=== ${issues} suspect ===` : '\n=== clean: no undefined function calls anywhere ===');
