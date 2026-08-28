import { raw } from './dom.js';

/**
 * Glyphs.
 *
 * Two sets, on purpose. MONO is the chrome — ticks, chevrons, the close
 * cross — rendered as monochrome Unicode in text presentation so it inherits
 * currentColor and sits in a button like type rather than like a sticker.
 * EMOJI is everything that depicts a thing in the world, where the colour is
 * the whole point of using a picture at all.
 *
 * Getting that split wrong in either direction is what makes an app look
 * cheap: colour emoji in navigation reads as clip art, and a hand-drawn SVG
 * of a mosque reads as a worse mosque than the one the system already has.
 */
const MONO = {
  check: '\u{2713}',
  checkCircle: '\u{2713}',
  chevron: '\u{203A}',
  close: '\u{2715}',
  dot: '\u{2022}',
  minus: '\u{2212}',
  half: '\u{25D0}',
  pointer: '\u{25B8}',
  alert: '\u{26A0}\u{FE0E}',
  star: '\u{2605}',
  gear: '\u{2699}\u{FE0E}',
  trend: '\u{2197}\u{FE0E}',
  lock: '\u{1F512}',
  ruh: '\u{2726}',
  jasad: '\u{25C6}',
  aql: '\u{25C8}',
  sabr: '\u{2756}',
  waqt: '\u{25F7}',
  worship: '\u{2727}',
  body: '\u{25C6}',
  mind: '\u{25C8}',
  work: '\u{25A3}',
  purity: '\u{271C}',
  sleep: '\u{263E}',
  bell: '\u{2691}',
  bellOff: '\u{2690}',
  clock: '\u{25F7}',
  timer: '\u{25D4}',
  hourglass: '\u{25D1}',
  calendar: '\u{25A4}',
  chart: '\u{25A6}',
  bolt: '\u{2726}',
  trophy: '\u{265B}',
  shield: '\u{271C}',
  target: '\u{25CE}',
  book: '\u{25A4}',
  books: '\u{25A6}',
  ledger: '\u{25A4}',
  cap: '\u{25B2}',
  flask: '\u{2697}\u{FE0E}',
  map: '\u{25A5}',
  wrench: '\u{271C}',
  box: '\u{25A3}',
  wave: '\u{2248}',
  moon: '\u{263E}',
  sprout: '\u{2727}',
  hands: '\u{2727}',
  lamp: '\u{2727}',
};

/**
 * What is still worth the colour: the streak, which is the one number this
 * app is really about, and the five moods, where the face IS the content.
 * The habits themselves carry their own emoji from data/library.js.
 */
const EMOJI = {
  flame: '\u{1F525}',
  moodGreat: '\u{1F604}',
  moodGood: '\u{1F642}',
  moodFlat: '\u{1F610}',
  moodLow: '\u{1F614}',
  moodBad: '\u{1F61E}',
};

const GLYPH = { ...MONO, ...EMOJI };

/**
 * A glyph, boxed to exactly the size the SVG used to occupy.
 *
 * The fixed width/height matters more than it looks: emoji have wildly
 * different advance widths between platforms, and without the box every row
 * in the app would shift by a pixel or two depending on which glyph landed
 * in it.
 */
export function icon(name, { size = 20, cls = '' } = {}) {
  const g = GLYPH[name] || MONO.dot;
  const mono = Object.prototype.hasOwnProperty.call(MONO, name);
  return raw(
    `<span class="ico ${mono ? 'ico--m' : 'ico--e'} ${cls}" aria-hidden="true"` +
    ` style="width:${size}px;height:${size}px;font-size:${(size * (mono ? 0.92 : 0.86)).toFixed(1)}px">${g}</span>`);
}

/** The same, as a plain string, for the few places that build HTML by hand. */
export function iconHTML(name, size = 20) {
  return String(icon(name, { size }));
}

export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(GLYPH, name); }

export const ICON_NAMES = Object.keys(GLYPH);
