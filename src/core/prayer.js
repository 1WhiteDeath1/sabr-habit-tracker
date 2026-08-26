// prayer.js — prayer times, computed offline from the sun's position.
// Standard solar-geometry method (the same one PrayTimes/IslamicFinder use).
// Everything is local: no network call, no location leaves the device.
//
// If the user has not given a location, we simply read the times they typed in
// Settings. Both paths return the same shape, so callers never branch.

import { parseHM, keyToDate } from './dates.js';

export const METHODS = {
  karachi: { label: 'Karachi (Univ. of Islamic Sciences)', fajr: 18,   isha: 18 },
  mwl:     { label: 'Muslim World League',                 fajr: 18,   isha: 17 },
  isna:    { label: 'ISNA (North America)',                fajr: 15,   isha: 15 },
  egypt:   { label: 'Egyptian General Authority',          fajr: 19.5, isha: 17.5 },
  makkah:  { label: 'Umm al-Qura, Makkah',                 fajr: 18.5, isha: null, ishaMinutes: 90 },
  tehran:  { label: 'Univ. of Tehran',                     fajr: 17.7, isha: 14 },
};

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const arcsin = (x) => Math.asin(x) / DEG;
const arccos = (x) => Math.acos(x) / DEG;
const arctan2 = (y, x) => Math.atan2(y, x) / DEG;
const arccot = (x) => Math.atan2(1, x) / DEG;

const fix = (a, b) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };
const fixAngle = (a) => fix(a, 360);
const fixHour = (a) => fix(a, 24);

function julian(year, month, day) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/** Sun declination and equation of time for a Julian day. */
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(arctan2(cos(e) * sin(L), cos(L)) / 15);
  return {
    declination: arcsin(sin(e) * sin(L)),
    equation: q / 15 - RA,
  };
}

/**
 * Compute prayer times.
 * @returns {{fajr:number, sunrise:number, dhuhr:number, asr:number, maghrib:number, isha:number}}
 *          each value in minutes since local midnight, or null if the sun never
 *          reaches that angle (high latitudes).
 */
export function computeTimes({ date, lat, lon, timezone, method = 'karachi', asrMethod = 'standard' }) {
  const cfg = METHODS[method] || METHODS.karachi;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lon / (15 * 24);
  const asrFactor = asrMethod === 'hanafi' ? 2 : 1;

  const midDay = (t) => fixHour(12 - sunPosition(jd + t).equation);

  const sunAngleTime = (angle, t, ccw) => {
    const decl = sunPosition(jd + t).declination;
    const noon = midDay(t);
    const ratio = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (ratio > 1 || ratio < -1) return null;   // sun never reaches this angle here
    const offset = arccos(ratio) / 15;
    return noon + (ccw ? -offset : offset);
  };

  const asrAngleTime = (t) => {
    const decl = sunPosition(jd + t).declination;
    return sunAngleTime(-arccot(asrFactor + tan(Math.abs(lat - decl))), t, false);
  };

  // Seed with rough guesses, then refine twice — the sun moves while we compute.
  // A null result keeps the previous seed rather than poisoning the next pass.
  let t = { fajr: 5 / 24, sunrise: 6 / 24, dhuhr: 12 / 24, asr: 13 / 24, sunset: 18 / 24, isha: 18 / 24 };
  for (let i = 0; i < 3; i++) {
    const next = {
      fajr:    hours(sunAngleTime(cfg.fajr, t.fajr, true)),
      sunrise: hours(sunAngleTime(0.833, t.sunrise, true)),
      dhuhr:   midDay(t.dhuhr) / 24,
      asr:     hours(asrAngleTime(t.asr)),
      sunset:  hours(sunAngleTime(0.833, t.sunset, false)),
      isha:    cfg.isha == null ? null : hours(sunAngleTime(cfg.isha, t.isha, false)),
    };
    for (const k of Object.keys(t)) if (next[k] != null) t[k] = next[k];
  }

  const tzShift = timezone - lon / 15;
  const wrap = (m) => ((Math.round(m) % 1440) + 1440) % 1440;
  const toMinutes = (h) => wrap(h * 24 * 60 + tzShift * 60);

  const sunrise = toMinutes(t.sunrise);
  const sunset = toMinutes(t.sunset);
  const dhuhr = wrap(toMinutes(t.dhuhr) + 1);   // dhuhr begins just after the zenith
  const asr = toMinutes(t.asr);
  const maghrib = wrap(sunset + 1);

  // Night length, used by the high-latitude rule below.
  const night = wrap(sunrise - sunset) || 1;

  // High latitudes: for part of the year the sun never dips to the twilight
  // angle, so the geometric answer is null or absurd. The accepted fallback is
  // the angle-based rule — take the same fraction of the night that the angle
  // represents out of 60 degrees. Below ~48 deg latitude this never triggers.
  const fajrRaw = t.fajr == null ? null : toMinutes(t.fajr);
  const fajrPortion = (cfg.fajr / 60) * night;
  const fajr = (fajrRaw == null || wrap(sunrise - fajrRaw) > fajrPortion)
    ? wrap(sunrise - fajrPortion)
    : fajrRaw;

  let isha;
  if (cfg.isha == null) {
    isha = wrap(sunset + (cfg.ishaMinutes || 90));   // Umm al-Qura: fixed interval
  } else {
    const ishaRaw = t.isha == null ? null : toMinutes(t.isha);
    const ishaPortion = (cfg.isha / 60) * night;
    isha = (ishaRaw == null || wrap(ishaRaw - sunset) > ishaPortion)
      ? wrap(sunset + ishaPortion)
      : ishaRaw;
  }

  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}

function hours(h) { return h == null ? null : h / 24; }

/**
 * The app-facing accessor. Reads settings and returns prayer times in minutes
 * since midnight for a given day key, whichever mode the user is in.
 */
export function prayerTimesFor(dayKeyStr, settings) {
  if (settings.prayerMode === 'auto' && settings.location) {
    const date = keyToDate(dayKeyStr);
    const timezone = -date.getTimezoneOffset() / 60;
    try {
      return computeTimes({
        date,
        lat: settings.location.lat,
        lon: settings.location.lon,
        timezone,
        method: settings.calcMethod,
        asrMethod: settings.asrMethod,
      });
    } catch (err) {
      console.error('[prayer] computation failed, falling back to manual times', err);
    }
  }
  const m = settings.manualPrayers || {};
  return {
    fajr: parseHM(m.fajr) ?? 5 * 60,
    sunrise: (parseHM(m.fajr) ?? 5 * 60) + 80,
    dhuhr: parseHM(m.dhuhr) ?? 12 * 60 + 15,
    asr: parseHM(m.asr) ?? 15 * 60 + 45,
    maghrib: parseHM(m.maghrib) ?? 18 * 60 + 40,
    isha: parseHM(m.isha) ?? 20 * 60,
  };
}

/** Which prayer window are we in right now? Returns {current, next, minutesToNext}. */
export function prayerWindow(times, nowMinutes) {
  const order = [
    ['fajr', times.fajr], ['sunrise', times.sunrise], ['dhuhr', times.dhuhr],
    ['asr', times.asr], ['maghrib', times.maghrib], ['isha', times.isha],
  ].filter(([, v]) => typeof v === 'number');

  let current = null;
  let next = null;
  for (let i = 0; i < order.length; i++) {
    if (nowMinutes >= order[i][1]) current = order[i];
    else { next = order[i]; break; }
  }
  if (!current) current = order[order.length - 1];       // before Fajr = still Isha's night
  if (!next) next = [order[0][0], order[0][1] + 1440];   // after Isha = tomorrow's Fajr

  return {
    current: current[0],
    currentAt: current[1],
    next: next[0],
    nextAt: next[1] % 1440,
    minutesToNext: next[1] - nowMinutes,
  };
}
