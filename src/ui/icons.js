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
};

const EMOJI = {
  bell: '\u{1F514}',
  bellOff: '\u{1F515}',
  ruh: '\u{1F54A}\u{FE0F}',
  jasad: '\u{1F4AA}',
  aql: '\u{1F9E0}',
  sabr: '\u{23F3}',
  waqt: '\u{23F0}',
  worship: '\u{1F54C}',
  body: '\u{1F4AA}',
  mind: '\u{1F9E0}',
  work: '\u{1F4BC}',
  purity: '\u{1F6E1}\u{FE0F}',
  sleep: '\u{1F319}',
  clock: '\u{1F550}',
  timer: '\u{23F1}\u{FE0F}',
  hourglass: '\u{23F3}',
  calendar: '\u{1F4C5}',
  chart: '\u{1F4CA}',
  flame: '\u{1F525}',
  bolt: '\u{26A1}',
  trophy: '\u{1F3C6}',
  shield: '\u{1F6E1}\u{FE0F}',
  target: '\u{1F3AF}',
  book: '\u{1F4D5}',
  books: '\u{1F4DA}',
  ledger: '\u{1F4D2}',
  cap: '\u{1F393}',
  flask: '\u{2697}\u{FE0F}',
  map: '\u{1F5FA}\u{FE0F}',
  wrench: '\u{1F527}',
  box: '\u{1F4E6}',
  wave: '\u{1F30A}',
  moon: '\u{1F319}',
  sprout: '\u{1F331}',
  hands: '\u{1F932}',
  lamp: '\u{1FA94}',
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
