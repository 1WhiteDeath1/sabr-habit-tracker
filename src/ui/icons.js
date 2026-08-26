// icons.js — the app's icon set.
//
// Emoji were doing this job badly: a different picture on every platform, their
// own colour so they ignore the theme and the category tint, mismatched weights,
// and half of them a picture of an object rather than of the idea.
//
// The first replacement set was worse in a different way — 2.1px hairline
// outlines in an app whose whole design language is "very round, very bold and
// physical, nothing is subtle". Correct in the abstract, wrong for this app.
//
// So these are duotone: a soft wash of currentColor behind a heavy stroke of it,
// which gives them weight and depth while still being a single colour. Both
// layers inherit, so a category tint, a white-on-disc quest node and a dark
// theme all just work.
//
//   <path class="f">   the fill layer — currentColor at low opacity, no stroke
//   everything else    stroked by the .ico rule in styles.css
//
// Shapes get to have a bit of character: the mosque has a dome and minarets, the
// brain has folds, the flame has a flame inside it. An icon set that is merely
// correct reads as a placeholder.

import { raw } from './dom.js';

const I = {
  /* --- structure and status ------------------------------------------ */
  check: '<path class="f" d="M4.6 12.4 9.4 17 19.4 6.9l-2.2-.6-8 8.2-3.3-3.2Z"/>'
       + '<path d="M4.4 12.4 9.4 17.4 19.6 6.7"/>',
  checkCircle: '<circle class="f" cx="12" cy="12" r="9.2"/>'
       + '<circle cx="12" cy="12" r="9.2"/><path d="M7.7 12.1 10.7 15.2 16.5 8.7"/>',
  alert: '<path class="f" d="M12 3.2 21.8 20.4H2.2L12 3.2Z"/>'
       + '<path d="M10.4 4.2a1.8 1.8 0 0 1 3.2 0l8 14a1.8 1.8 0 0 1-1.6 2.7H4a1.8 1.8 0 0 1-1.6-2.7l8-14Z"/>'
       + '<path d="M12 9.6v4.3"/><circle cx="12" cy="17.4" r="1.15" fill="currentColor" stroke="none"/>',
  lock: '<rect class="f" x="4.2" y="10.2" width="15.6" height="11" rx="3"/>'
       + '<rect x="4.2" y="10.2" width="15.6" height="11" rx="3"/>'
       + '<path d="M7.9 10.2V7.5a4.1 4.1 0 0 1 8.2 0v2.7"/>'
       + '<circle cx="12" cy="15.7" r="1.5" fill="currentColor" stroke="none"/>',
  dot: '<circle class="f" cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/>',
  chevron: '<path d="M9.4 5.2 16.4 12l-7 6.8"/>',
  bell: '<path class="f" d="M18.2 8.8a6.2 6.2 0 0 0-12.4 0c0 6.2-2.7 8-2.7 8h17.8s-2.7-1.8-2.7-8Z"/>'
       + '<path d="M18.2 8.8a6.2 6.2 0 0 0-12.4 0c0 6.2-2.7 8-2.7 8h17.8s-2.7-1.8-2.7-8Z"/>'
       + '<path d="M14 20.3a2.2 2.2 0 0 1-4 0"/><path d="M12 2.6v-.9"/>',
  bellOff: '<path class="f" d="M18.2 8.8a6.2 6.2 0 0 0-12.4 0c0 6.2-2.7 8-2.7 8h17.8s-2.7-1.8-2.7-8Z"/>'
       + '<path d="M18.2 8.8a6.2 6.2 0 0 0-12.4 0c0 6.2-2.7 8-2.7 8h17.8s-2.7-1.8-2.7-8Z"/>'
       + '<path d="M14 20.3a2.2 2.2 0 0 1-4 0"/><path d="M3.6 3.6 20.4 20.4"/>',
  close: '<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/>',
  minus: '<path d="M5.8 12h12.4"/>',
  half: '<path class="f" d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z"/>'
       + '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z" fill="currentColor" stroke="none"/>',
  pointer: '<path class="f" d="M8.8 12V6a1.9 1.9 0 0 1 3.8 0v4.6l1-.4 2.6.5 2.6 1.3v4.4a5.2 5.2 0 0 1-5.2 5.2h-1.9a5.2 5.2 0 0 1-3.9-1.8l-3.2-3.6 1.9-1.6 2.3 1.5Z"/>'
       + '<path d="M8.8 11.8V5.9a1.9 1.9 0 0 1 3.8 0v5.3"/>'
       + '<path d="M12.6 11.3V9.7a1.8 1.8 0 0 1 3.6 0v1.8"/>'
       + '<path d="M16.2 11.8v-1a1.8 1.8 0 0 1 3.6 0v5.6a5.2 5.2 0 0 1-5.2 5.2h-2.2a5.2 5.2 0 0 1-3.9-1.8L4.8 15.6a1.9 1.9 0 0 1 2.8-2.4l1.4 1.5"/>',

  /* --- the five attributes -------------------------------------------- */
  // Spirit: a flame with a flame inside it.
  ruh: '<path class="f" d="M12 2.6c3.9 2.7 6.1 5.6 6.1 8.8a6.1 6.1 0 1 1-12.2 0c0-3.2 2.2-6.1 6.1-8.8Z"/>'
     + '<path d="M12 2.6c3.9 2.7 6.1 5.6 6.1 8.8a6.1 6.1 0 1 1-12.2 0c0-3.2 2.2-6.1 6.1-8.8Z"/>'
     + '<path d="M12 9.8c1.8 1.4 2.7 2.7 2.7 4.1a2.7 2.7 0 1 1-5.4 0c0-1.4.9-2.7 2.7-4.1Z"/>',
  // Body: a loaded bar, plates and all.
  jasad: '<rect class="f" x="5.6" y="8.4" width="12.8" height="7.2" rx="1.6"/>'
       + '<path d="M2.4 9.6v4.8M5.6 7.2v9.6M21.6 9.6v4.8M18.4 7.2v9.6"/>'
       + '<path d="M5.6 12h12.8"/><rect x="5.6" y="7.2" width="2.6" height="9.6" rx="1.2"/>'
       + '<rect x="15.8" y="7.2" width="2.6" height="9.6" rx="1.2"/>',
  // Mind: a brain with folds.
  // One mass with a sinuous central sulcus, not two halves either side of a
  // rule — that version read as a walnut. The outline is deliberately not
  // mirror-symmetric, because a symmetrical brain looks like a diagram.
  aql: '<path class="f" d="M9.1 3.5C6.4 3.9 4.5 5.7 4.3 8 2.9 9 2.7 11.1 3.9 12.4c-.4 2.2.9 4.3 3 5 .5 1.9 2.5 3.1 4.4 2.6 1.2 1 3 .8 4-.5 2.5-.1 4.6-1.9 5-4.3 1.4-1 1.7-3 .7-4.4.2-2.5-1.5-4.8-4-5.4C15.9 3 12.2 2.3 9.1 3.5Z"/>'
     + '<path d="M9.1 3.5C6.4 3.9 4.5 5.7 4.3 8 2.9 9 2.7 11.1 3.9 12.4c-.4 2.2.9 4.3 3 5 .5 1.9 2.5 3.1 4.4 2.6 1.2 1 3 .8 4-.5 2.5-.1 4.6-1.9 5-4.3 1.4-1 1.7-3 .7-4.4.2-2.5-1.5-4.8-4-5.4C15.9 3 12.2 2.3 9.1 3.5Z"/>'
     + '<path d="M11.6 3.2c-1.5 1.7-1.4 3.6.2 5.1 1.6 1.5 1.6 3.5.1 5.1-1.4 1.5-1.4 3.4 0 5.1"/>'
     + '<path d="M4.4 8.2c1.9-.2 3.1.7 3.4 2.5"/>'
     + '<path d="M7.1 17.2c.6-1.6 1.7-2.3 3.3-2.1"/>'
     + '<path d="M19.6 8.3c-1.8.1-2.9 1-3.2 2.7"/>'
     + '<path d="M20.9 14.9c-1.6-.5-2.9 0-3.7 1.5"/>',
  // Restraint: a shield inside a shield.
  sabr: '<path class="f" d="M12 2.4 3.9 5.4v6c0 4.9 3.3 9.5 8.1 10.6 4.8-1.1 8.1-5.7 8.1-10.6v-6L12 2.4Z"/>'
      + '<path d="M12 2.4 3.9 5.4v6c0 4.9 3.3 9.5 8.1 10.6 4.8-1.1 8.1-5.7 8.1-10.6v-6L12 2.4Z"/>'
      + '<path d="M12 6.6 7.4 8.3v3.3c0 2.8 1.9 5.4 4.6 6.1 2.7-.7 4.6-3.3 4.6-6.1V8.3L12 6.6Z"/>',
  // Time: an hourglass with the sand in it.
  waqt: '<path class="f" d="M7.4 3.4h9.2v2.9c0 2.6-4.6 3.9-4.6 5.7s4.6 3.1 4.6 5.7v2.9H7.4v-2.9c0-2.6 4.6-3.9 4.6-5.7S7.4 8.9 7.4 6.3V3.4Z"/>'
      + '<path d="M6 2.8h12M6 21.2h12"/>'
      + '<path d="M7.4 2.8v3.5c0 2.6 4.6 3.9 4.6 5.7s-4.6 3.1-4.6 5.7v3.5M16.6 2.8v3.5c0 2.6-4.6 3.9-4.6 5.7s4.6 3.1 4.6 5.7v3.5"/>'
      + '<path d="M9.6 18.6c.7-1.4 1.6-2.1 2.4-2.1s1.7.7 2.4 2.1Z" fill="currentColor" stroke="none"/>',

  /* --- the six habit categories --------------------------------------- */
  // Worship: dome, arch and minarets.
  // Onion dome, not a semicircle: it swells past the drum and comes to a point,
  // which is the half of the silhouette that makes it a mosque. Minarets get
  // caps and balconies so they read as towers rather than stray strokes.
  worship: '<path class="f" d="M7.7 11.5C7.7 8.6 9.2 6.7 12 4.3c2.8 2.4 4.3 4.3 4.3 7.2Z"/>'
         + '<path class="f" d="M6.3 11.5h11.4v8.4H6.3z"/>'
         + '<path class="f" d="M3.1 10.9C3.1 9.6 4 8.8 4.2 7.7c.2 1.1 1.1 1.9 1.1 3.2ZM18.7 10.9c0-1.3.9-2.1 1.1-3.2.2 1.1 1.1 1.9 1.1 3.2Z"/>'
         + '<path d="M7.7 11.5C7.7 8.6 9.2 6.7 12 4.3c2.8 2.4 4.3 4.3 4.3 7.2"/>'
         + '<path d="M6.3 19.9v-8.4h11.4v8.4"/>'
         + '<path d="M10.1 19.9v-3.2a1.9 1.9 0 0 1 3.8 0v3.2"/>'
         + '<path d="M3.1 19.9v-9C3.1 9.6 4 8.8 4.2 7.7c.2 1.1 1.1 1.9 1.1 3.2v9"/>'
         + '<path d="M18.7 19.9v-9c0-1.3.9-2.1 1.1-3.2.2 1.1 1.1 1.9 1.1 3.2v9"/>'
         + '<path d="M3.1 13.4h2.2M18.7 13.4h2.2"/>'
         + '<path d="M2.2 20h19.6"/>'
         + '<path d="M12 4.3V2.6"/>'
         + '<circle cx="12" cy="2.2" r="1" fill="currentColor" stroke="none"/>',
  body: '<rect class="f" x="5.6" y="8.4" width="12.8" height="7.2" rx="1.6"/>'
      + '<path d="M2.4 9.6v4.8M5.6 7.2v9.6M21.6 9.6v4.8M18.4 7.2v9.6"/>'
      + '<path d="M5.6 12h12.8"/><rect x="5.6" y="7.2" width="2.6" height="9.6" rx="1.2"/>'
      + '<rect x="15.8" y="7.2" width="2.6" height="9.6" rx="1.2"/>',
  // Mind: an open book, pages and spine.
  mind: '<path class="f" d="M12 6.4C10.2 4.9 7.7 4.4 3.8 4.6v13.2c3.9-.2 6.4.3 8.2 1.8 1.8-1.5 4.3-2 8.2-1.8V4.6c-3.9-.2-6.4.3-8.2 1.8Z"/>'
      + '<path d="M12 6.4C10.2 4.9 7.7 4.4 3.8 4.6v13.2c3.9-.2 6.4.3 8.2 1.8 1.8-1.5 4.3-2 8.2-1.8V4.6c-3.9-.2-6.4.3-8.2 1.8Z"/>'
      + '<path d="M12 6.4v13.2"/>',
  // Work: a case with a clasp.
  work: '<rect class="f" x="2.8" y="7.2" width="18.4" height="13" rx="2.8"/>'
      + '<rect x="2.8" y="7.2" width="18.4" height="13" rx="2.8"/>'
      + '<path d="M8.4 7.2V5.6a2.2 2.2 0 0 1 2.2-2.2h2.8a2.2 2.2 0 0 1 2.2 2.2v1.6"/>'
      + '<path d="M2.8 12.6c3 1.4 5.9 2.1 9.2 2.1s6.2-.7 9.2-2.1"/>'
      + '<path d="M10.6 13.8h2.8"/>',
  // Purity: a droplet with a highlight.
  purity: '<path class="f" d="M12 2.8c3 3.3 5.3 6.1 5.3 9.2a5.3 5.3 0 1 1-10.6 0c0-3.1 2.3-5.9 5.3-9.2Z"/>'
        + '<path d="M12 2.8c3 3.3 5.3 6.1 5.3 9.2a5.3 5.3 0 1 1-10.6 0c0-3.1 2.3-5.9 5.3-9.2Z"/>'
        + '<path d="M9.3 13.4a2.7 2.7 0 0 0 2.2 3.5"/>',
  // Sleep: a crescent with two small stars.
  sleep: '<path class="f" d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6a9 9 0 1 0 11.2 11.2Z"/>'
       + '<path d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6a9 9 0 1 0 11.2 11.2Z"/>'
       + '<path d="M16.6 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6Z" fill="currentColor" stroke="none"/>',

  /* --- time and progress ----------------------------------------------- */
  clock: '<circle class="f" cx="12" cy="12" r="8.8"/>'
       + '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.9V12l3.4 2.1"/>'
       + '<path d="M12 3.2v1.3M20.8 12h-1.3M12 20.8v-1.3M3.2 12h1.3"/>',
  timer: '<circle class="f" cx="12" cy="13.8" r="7.6"/>'
       + '<circle cx="12" cy="13.8" r="7.6"/><path d="M9.2 2.4h5.6M12 2.4v3.2"/>'
       + '<path d="M12 10v3.8l2.7 1.7"/><path d="M18.6 6.6 20 5.2"/>',
  hourglass: '<path class="f" d="M7.4 3.4h9.2v2.9c0 2.6-4.6 3.9-4.6 5.7s4.6 3.1 4.6 5.7v2.9H7.4v-2.9c0-2.6 4.6-3.9 4.6-5.7S7.4 8.9 7.4 6.3V3.4Z"/>'
           + '<path d="M6 2.8h12M6 21.2h12"/>'
           + '<path d="M7.4 2.8v3.5c0 2.6 4.6 3.9 4.6 5.7s-4.6 3.1-4.6 5.7v3.5M16.6 2.8v3.5c0 2.6-4.6 3.9-4.6 5.7s4.6 3.1 4.6 5.7v3.5"/>',
  calendar: '<rect class="f" x="3" y="5" width="18" height="16" rx="3"/>'
          + '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10.2h18"/>'
          + '<path d="M8 2.6v4.2M16 2.6v4.2"/>'
          + '<circle cx="8.4" cy="14.4" r="1.25" fill="currentColor" stroke="none"/>'
          + '<circle cx="12" cy="14.4" r="1.25" fill="currentColor" stroke="none"/>'
          + '<circle cx="15.6" cy="14.4" r="1.25" fill="currentColor" stroke="none"/>',
  trend: '<path class="f" d="M3.2 17.2 9 11.2l3.6 3.4 7.4-7.6v13.4H3.2v-3.2Z"/>'
       + '<path d="M3.2 16.8 9 10.8l3.6 3.4 8-8.2"/><path d="M15.2 5.8h5.6v5.6"/>',
  chart: '<path class="f" d="M6.6 12.4h3.6v6.4H6.6zM13.8 7.8h3.6v11H13.8z"/>'
       + '<path d="M3.6 3.4v17.2h17"/>'
       + '<rect x="6.6" y="12.4" width="3.6" height="6.4" rx="1.2"/>'
       + '<rect x="13.8" y="7.8" width="3.6" height="11" rx="1.2"/>',

  /* --- objects and places ---------------------------------------------- */
  flame: '<path class="f" d="M12.8 2c1.1 3.7-.9 5.4-2.5 7.3-1.7 1.9-3.3 3.4-3.3 6a5 5 0 0 0 10 0c0-2.9-1.8-4.7-3.1-6.4-.9-1.2-1.4-2.2-1.3-3.6-1.1.6-2.1 1.6-2.7 2.8-.2-2.2.4-4.5 1.2-6.4Z"/>'
       + '<path d="M12.8 2c1.1 3.7-.9 5.4-2.5 7.3-1.7 1.9-3.3 3.4-3.3 6a5 5 0 0 0 10 0c0-2.9-1.8-4.7-3.1-6.4-.9-1.2-1.4-2.2-1.3-3.6-1.1.6-2.1 1.6-2.7 2.8-.2-2.2.4-4.5 1.2-6.4Z"/>'
       + '<path d="M12.3 12.6c.6 1.9-.4 2.5-1 3.2-.5.6-.9 1.3-.9 2.1a2.6 2.6 0 0 0 5.2 0c0-1.4-1-2.3-1.7-3.2-.6-.7-1-1.3-1.6-2.1Z"/>',
  bolt: '<path class="f" d="M13.6 2 4 13.6h6.6L9.5 22 20 9.9h-6.9L13.6 2Z"/>'
      + '<path d="M13.6 2 4 13.6h6.6L9.5 22 20 9.9h-6.9L13.6 2Z"/>',
  star: '<path class="f" d="m12 2.6 3 6.2 6.8.9-4.9 4.7 1.2 6.8L12 17.9l-6.1 3.3 1.2-6.8-4.9-4.7 6.8-.9L12 2.6Z"/>'
      + '<path d="m12 2.6 3 6.2 6.8.9-4.9 4.7 1.2 6.8L12 17.9l-6.1 3.3 1.2-6.8-4.9-4.7 6.8-.9L12 2.6Z"/>',
  trophy: '<path class="f" d="M7 3.4h10v5.4a5 5 0 0 1-10 0V3.4Z"/>'
        + '<path d="M7 3.4h10v5.4a5 5 0 0 1-10 0V3.4Z"/>'
        + '<path d="M7 5.4H4.6a2.2 2.2 0 0 0 0 4.4H7.4M17 5.4h2.4a2.2 2.2 0 0 1 0 4.4H16.6"/>'
        + '<path d="M12 13.8v3.4M8 20.6h8a2 2 0 0 0-2-3.4h-4a2 2 0 0 0-2 3.4Z"/>'
        + '<path d="m12 5.4.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 7.5l2-.3.9-1.8Z" fill="currentColor" stroke="none"/>',
  shield: '<path class="f" d="M12 2.4 3.9 5.4v6c0 4.9 3.3 9.5 8.1 10.6 4.8-1.1 8.1-5.7 8.1-10.6v-6L12 2.4Z"/>'
        + '<path d="M12 2.4 3.9 5.4v6c0 4.9 3.3 9.5 8.1 10.6 4.8-1.1 8.1-5.7 8.1-10.6v-6L12 2.4Z"/>'
        + '<path d="M8.4 11.9 10.9 14.4 15.6 9.4"/>',
  target: '<circle class="f" cx="12" cy="12" r="8.8"/>'
        + '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.6"/>'
        + '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  book: '<path class="f" d="M12 6.4C10.2 4.9 7.7 4.4 3.8 4.6v13.2c3.9-.2 6.4.3 8.2 1.8 1.8-1.5 4.3-2 8.2-1.8V4.6c-3.9-.2-6.4.3-8.2 1.8Z"/>'
      + '<path d="M12 6.4C10.2 4.9 7.7 4.4 3.8 4.6v13.2c3.9-.2 6.4.3 8.2 1.8 1.8-1.5 4.3-2 8.2-1.8V4.6c-3.9-.2-6.4.3-8.2 1.8Z"/>'
      + '<path d="M12 6.4v13.2"/>',
  books: '<path class="f" d="M3.4 4.6h4.2v14.8H3.4zM9.4 4.6h4.2v14.8H9.4z"/>'
       + '<rect x="3.4" y="4.6" width="4.2" height="14.8" rx="1.5"/>'
       + '<rect x="9.4" y="4.6" width="4.2" height="14.8" rx="1.5"/>'
       + '<path d="M15.8 6.4 19.7 7.5 16.6 19.4 12.7 18.3"/>'
       + '<path d="M3.4 8.6h4.2M9.4 8.6h4.2"/>',
  ledger: '<rect class="f" x="4.6" y="2.8" width="14.8" height="18.4" rx="3"/>'
        + '<rect x="4.6" y="2.8" width="14.8" height="18.4" rx="3"/>'
        + '<path d="M8.6 7.6h6.8M8.6 12h6.8M8.6 16.4h3.8"/>'
        + '<path d="M4.6 6.6h-2M4.6 12h-2M4.6 17.4h-2"/>',
  cap: '<path class="f" d="M12 3 1.6 8.2 12 13.4l10.4-5.2L12 3Z"/>'
     + '<path d="M12 3 1.6 8.2 12 13.4l10.4-5.2L12 3Z"/>'
     + '<path d="M5.4 10.6v4.9c0 2 3 3.5 6.6 3.5s6.6-1.5 6.6-3.5v-4.9"/>'
     + '<path d="M22.4 8.2v5.2"/>',
  flask: '<path class="f" d="M9.2 9.2 4 18.2a2.5 2.5 0 0 0 2.2 3.8h11.6a2.5 2.5 0 0 0 2.2-3.8l-5.2-9V2.6H9.2v6.6Z"/>'
       + '<path d="M9.2 2.6v6.4L4 18.2a2.5 2.5 0 0 0 2.2 3.8h11.6a2.5 2.5 0 0 0 2.2-3.8l-5.2-9.2V2.6"/>'
       + '<path d="M7.6 2.6h8.8M6.9 15h10.2"/>'
       + '<circle cx="10" cy="17.6" r="1.1" fill="currentColor" stroke="none"/>'
       + '<circle cx="13.8" cy="19" r="0.9" fill="currentColor" stroke="none"/>',
  map: '<path class="f" d="M8.8 3.8 3 6.4v13.8l5.8-2.6 6.4 2.6 5.8-2.6V3.8l-5.8 2.6-6.4-2.6Z"/>'
     + '<path d="M8.8 3.8 3 6.4v13.8l5.8-2.6 6.4 2.6 5.8-2.6V3.8l-5.8 2.6-6.4-2.6Z"/>'
     + '<path d="M8.8 3.8v13.8M15.2 6.4v13.8"/>',
  gear: '<circle class="f" cx="12" cy="12" r="9.2"/>'
      + '<path d="M12 2.2 14 4.4l2.9-.7 1 2.8 2.8 1-.7 2.9 2.2 2-2.2 2 .7 2.9-2.8 1-1 2.8-2.9-.7-2 2.2-2-2.2-2.9.7-1-2.8-2.8-1 .7-2.9-2.2-2 2.2-2-.7-2.9 2.8-1 1-2.8 2.9.7 2-2.2Z"/>'
      + '<circle cx="12" cy="12" r="3.4"/>',
  wrench: '<path class="f" d="M20.4 6.2a5.6 5.6 0 0 1-7.5 5.3L6 18.4a2.4 2.4 0 0 1-3.4-3.4l6.9-6.9A5.6 5.6 0 0 1 16.6 2.6l-3.1 3.1 1.4 3.4 3.4 1.4 2.1-4.3Z"/>'
        + '<path d="M20.4 6.2a5.6 5.6 0 0 1-7.5 5.3L6 18.4a2.4 2.4 0 0 1-3.4-3.4l6.9-6.9A5.6 5.6 0 0 1 16.6 2.6l-3.1 3.1 1.4 3.4 3.4 1.4 2.1-4.3Z"/>',
  box: '<path class="f" d="M3.2 7.8 12 3.2l8.8 4.6v8.4L12 20.8l-8.8-4.6V7.8Z"/>'
     + '<path d="M3.2 7.8 12 3.2l8.8 4.6v8.4L12 20.8l-8.8-4.6V7.8Z"/>'
     + '<path d="M3.2 7.8 12 12.4l8.8-4.6M12 12.4v8.4M7.6 5.5l8.8 4.6"/>',
  wave: '<path class="f" d="M2.2 12.4c2.2-2.8 4.4-2.8 6.6 0s4.4 2.8 6.6 0 4.4-2.8 6.6 0v9H2.2v-9Z"/>'
      + '<path d="M2.2 7.6c2.2-2.6 4.4-2.6 6.6 0s4.4 2.6 6.6 0 4.4-2.6 6.6 0"/>'
      + '<path d="M2.2 13c2.2-2.6 4.4-2.6 6.6 0s4.4 2.6 6.6 0 4.4-2.6 6.6 0"/>'
      + '<path d="M2.2 18.4c2.2-2.6 4.4-2.6 6.6 0s4.4 2.6 6.6 0 4.4-2.6 6.6 0"/>',
  moon: '<path class="f" d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6a9 9 0 1 0 11.2 11.2Z"/>'
      + '<path d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6a9 9 0 1 0 11.2 11.2Z"/>',
  sprout: '<path class="f" d="M12 13.8C12 9.9 9.1 6.9 5.3 6.9c0 3.9 2.9 6.9 6.7 6.9ZM12.6 12.6c0-3.3 2.6-6 5.9-6 0 3.3-2.6 6-5.9 6Z"/>'
        + '<path d="M12 21.4v-7.8"/>'
        + '<path d="M12 13.6C12 9.8 9.1 6.8 5.4 6.8c0 3.8 2.9 6.8 6.6 6.8Z"/>'
        + '<path d="M12.6 12.4c0-3.3 2.6-6 5.8-6 0 3.3-2.6 6-5.8 6Z"/>',
  hands: '<path class="f" d="M2.4 12.2 6 8.8l3.7 1.5L12 8.6l2.3 1.7L18 8.8l3.6 3.4-4.7 5.6-4.9-1.7-4.9 1.7-4.7-5.6Z"/>'
       + '<path d="M2.4 12.2 6 8.8l3.7 1.5L12 8.6l2.3 1.7L18 8.8l3.6 3.4-4.7 5.6-4.9-1.7-4.9 1.7-4.7-5.6Z"/>'
       + '<path d="M12 8.6v7.3"/>',
  lamp: '<path class="f" d="M8.4 7.4h7.2v8.9a3.6 3.6 0 0 1-7.2 0V7.4Z"/>'
      + '<path d="M8.4 4.2a3.6 3.6 0 0 1 7.2 0"/>'
      + '<rect x="7.1" y="4.2" width="9.8" height="2.9" rx="1.45" fill="currentColor" stroke="none"/>'
      + '<path d="M8.4 7.4h7.2v8.9a3.6 3.6 0 0 1-7.2 0V7.4Z"/>'
      + '<rect x="8.6" y="19.2" width="6.8" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>'
      + '<path d="M12 16.6v2.6"/>',

  /* --- mood faces, one family ------------------------------------------- */
  moodGreat: '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/>'
           + '<path d="M7.8 13.8a4.8 4.8 0 0 0 8.4 0Z" fill="currentColor" stroke="none"/>'
           + '<path d="M7.8 13.8a4.8 4.8 0 0 0 8.4 0"/>'
           + '<path d="M8.2 8.6c.7-.8 1.5-.8 2.2 0M13.6 8.6c.7-.8 1.5-.8 2.2 0"/>',
  moodGood:  '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/>'
           + '<path d="M8.4 14a4.3 4.3 0 0 0 7.2 0"/>'
           + '<circle cx="9.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>'
           + '<circle cx="14.8" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  moodFlat:  '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/>'
           + '<path d="M8.6 14.8h6.8"/>'
           + '<circle cx="9.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>'
           + '<circle cx="14.8" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  moodLow:   '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/>'
           + '<path d="M8.6 16a4.3 4.3 0 0 1 6.8 0"/>'
           + '<circle cx="9.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>'
           + '<circle cx="14.8" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  moodBad:   '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/>'
           + '<path d="M8.2 16.6a4.6 4.6 0 0 1 7.6 0"/>'
           + '<path d="M8 8.6c.8.5 1.5.9 2.4 1M16 8.6c-.8.5-1.5.9-2.4 1"/>'
           + '<circle cx="9.4" cy="10.4" r="1.05" fill="currentColor" stroke="none"/>'
           + '<circle cx="14.6" cy="10.4" r="1.05" fill="currentColor" stroke="none"/>',
};

/** Fallback so a typo shows a neutral mark rather than nothing at all. */
const FALLBACK = I.dot;

/**
 * An icon, as inline SVG.
 * `size` is CSS pixels; the geometry is always on a 24px grid.
 */
export function icon(name, { size = 20, cls = '' } = {}) {
  const body = I[name] || FALLBACK;
  return raw(`<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`);
}

/** The same, as a plain string, for the few places that build HTML by hand. */
export function iconHTML(name, size = 20) {
  return String(icon(name, { size }));
}

export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(I, name); }

export const ICON_NAMES = Object.keys(I);
