import {
  dateToJulianDay,
  julianDayToDate,
  calculatePosition,
  calculateRiseTransitSet,
  setSiderealMode,
  Planet,
  RiseTransitFlag,
  CalculationFlag,
  SiderealMode,
} from '@swisseph/node';
import { calendarDateKeyInTz, midnightInTz } from './timezone.js';

const SIDEREAL_FLAGS = CalculationFlag.SwissEphemeris | CalculationFlag.Speed | CalculationFlag.Sidereal;
const TROPICAL_FLAGS = CalculationFlag.SwissEphemeris | CalculationFlag.Speed;

const NAKSHATRA_DEG = 360 / 27;
const YOGA_DEG = 360 / 27;
const TITHI_DEG = 360 / 30;
const GHATIKA_MINUTES = 24;
const VARJAM_DURATION_MINUTES = 96;
const AMRITA_DURATION_FACTOR = 1.6 / 24;

// Nakshatra-wise thyajya start offsets in ghatikas (Ashwini..Revati).
// Source provided by user: varjam starts at this offset from nakshatra start,
// and lasts for 4 ghatis (96 minutes).
const NAKSHATRA_THYAJYA_GHATIKA_OFFSETS: number[] = [
  50, 4, 30, 40, 14, 21, 30, 20, 32, 30, 20, 1, 21, 20, 14, 14, 10, 14, 20, 20, 20, 10, 10, 18, 16, 30, 30,
];

// Nakshatra-wise Amrita start offsets X (in hours for a 24-hour nakshatra).
// Actual start offset scales with current nakshatra duration:
// start = nakshatraStart + (X/24) * nakshatraDuration.
const NAKSHATRA_AMRITA_START_HOURS: number[] = [
  16.8, 19.2, 21.6, 20.8, 15.2, 14.4, 21.6, 17.6, 22.4, 21.6, 17.6, 16.8, 18.4, 17.6, 15.2, 15.2, 13.6, 15.2,
  17.6, 19.2, 17.6, 13.6, 13.6, 16.8, 16.0, 19.2, 21.6,
];

export interface SunriseSunset {
  sunrise: Date;
  sunset: Date;
}

export interface MoonriseMoonset {
  moonrise: Date | null;
  moonset: Date | null;
}

export function getSunriseSunset(
  dateStr: string,
  lat: number,
  lon: number,
  tz: string
): SunriseSunset {
  const localMidnight = midnightInTz(dateStr, tz);
  const jdStart = dateToJulianDay(localMidnight) - 0.5;

  const sunrise = calculateRiseTransitSet(
    jdStart,
    Planet.Sun,
    RiseTransitFlag.Rise,
    lon,
    lat,
    0,
    TROPICAL_FLAGS
  );
  const sunriseJd = sunrise.time;
  const sunset = calculateRiseTransitSet(
    sunriseJd,
    Planet.Sun,
    RiseTransitFlag.Set,
    lon,
    lat,
    0,
    TROPICAL_FLAGS
  );

  return {
    sunrise: jdToDate(sunriseJd),
    sunset: jdToDate(sunset.time),
  };
}

/**
 * Collect successive rise or set JDs from Swiss Ephemeris between jdFrom (inclusive search) and jdTo.
 */
function collectRiseTransitSequence(
  planet: Planet,
  event: RiseTransitFlag.Rise | RiseTransitFlag.Set,
  jdFrom: number,
  jdTo: number,
  lon: number,
  lat: number,
  maxEvents: number
): number[] {
  const out: number[] = [];
  let jd = jdFrom;
  for (let i = 0; i < maxEvents && jd < jdTo; i++) {
    try {
      const r = calculateRiseTransitSet(jd, planet, event, lon, lat, 0, TROPICAL_FLAGS);
      if (!Number.isFinite(r.time)) break;
      if (r.time <= jd) {
        jd += 1e-5;
        continue;
      }
      if (r.time >= jdTo) break;
      out.push(r.time);
      jd = r.time + 1e-7;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Moonrise / moonset for civil `dateStr` in `tz`: first rise and first set whose local calendar date
 * in `tz` equals `dateStr`. Scans a window around that day so early-morning moonset is not skipped
 * when the next rise is later (previous logic only took the next rise after midnight, then its set).
 */
export function getMoonriseMoonset(
  dateStr: string,
  lat: number,
  lon: number,
  tz: string
): MoonriseMoonset {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  const thisMid = midnightInTz(dateStr, tz);
  const nextMid = midnightInTz(nextDateStr, tz);
  const jdWindowStart = dateToJulianDay(thisMid) - 1;
  const jdWindowEnd = dateToJulianDay(nextMid) + 1;

  const riseJds = collectRiseTransitSequence(
    Planet.Moon,
    RiseTransitFlag.Rise,
    jdWindowStart,
    jdWindowEnd,
    lon,
    lat,
    8
  );
  const setJds = collectRiseTransitSequence(
    Planet.Moon,
    RiseTransitFlag.Set,
    jdWindowStart,
    jdWindowEnd,
    lon,
    lat,
    8
  );

  const onDay = (jd: number) => calendarDateKeyInTz(jdToDate(jd), tz) === dateStr;

  const risesToday = riseJds.filter(onDay);
  const setsToday = setJds.filter(onDay);

  let moonrise: Date | null = null;
  let moonset: Date | null = null;
  if (risesToday.length > 0) {
    moonrise = jdToDate(Math.min(...risesToday));
  }
  if (setsToday.length > 0) {
    moonset = jdToDate(Math.min(...setsToday));
  }

  return { moonrise, moonset };
}

function jdToDate(jd: number): Date {
  const dt = julianDayToDate(jd);
  const dayMs = Date.UTC(dt.year, dt.month - 1, dt.day, 0, 0, 0, 0);
  const hourMs = (dt.hour ?? 0) * 3600 * 1000;
  return new Date(dayMs + hourMs);
}

export interface PanchangElement {
  index: number;
  nameKey: string;
  /** Instant when this segment began (UT-backed `Date`). */
  startTime: Date;
  endTime: Date | null;
}

export interface Kaalam {
  name: string;
  start: Date;
  end: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PanchangResult {
  date: string;
  sunrise: Date;
  sunset: Date;
  tithi: PanchangElement;
  nakshatra: PanchangElement;
  yoga: PanchangElement;
  karanas: PanchangElement[];
  kaalams: Kaalam[];
  vara: number;
  /** 0 = Shukla, 1 = Krishna (at sunrise) */
  paksham: number;
  /** Rashi index 0–11 (Mesha to Meena) at sunrise */
  moonsign: number;
  /** Rashi index 0–11 at sunrise */
  sunsign: number;
  /**
   * Amanta lunar month 0 = Chaitra … 11 = Phalguna (Telugu-style sun-sign mapping + Krishna shift,
   * with a March-new-moon exception so Chaitra Krishna is not labelled Phalguna while Sun is in Meena).
   */
  lunarMonthIndex: number;
  /** Six seasons (ṛtu) 0–5 — see ruthuvuIndexFromPanchang */
  ruthuvuIndex: number;
  /** Moonrise for the civil date in the given timezone (if any) */
  moonrise: Date | null;
  /** Moonset for the civil date in the given timezone (if any) */
  moonset: Date | null;
  /** Abhijit muhurta: 24 min before to 24 min after solar noon */
  abhijit: TimeRange;
  /** Brahma muhurta: 96 min before sunrise, duration 48 min */
  brahmaMuhurtam: TimeRange;
  /** Amruta ghadiyalu (auspicious chaughadia) – one period per day */
  amrutaGhadiyalu: TimeRange[];
  /** Varjam: last 96 min of nakshatra (when in day window) */
  varjam: TimeRange | null;
  /**
   * Durmuhurtam (inauspicious): fixed offsets from sunrise (and Tuesday’s second slot from sunset);
   * 48 min each except Saturday 96 min from sunrise. Weekday 0=Sun … 6=Sat at sunrise in local TZ.
   */
  durmuhurtham: TimeRange[];
}

function normalizeLon(lon: number): number {
  let l = lon % 360;
  if (l < 0) l += 360;
  return l;
}

type SunMoonLon = { sun: number; moon: number };

function moonSunConjunctionSepDeg(jd: number, getSunMoon: (jd: number) => SunMoonLon): number {
  const { sun, moon } = getSunMoon(jd);
  const e = normalizeLon(moon - sun);
  return Math.min(e, 360 - e);
}

function refineMinimumUnimodal(
  jdLo: number,
  jdHi: number,
  f: (jd: number) => number,
  iterations: number
): number {
  for (let i = 0; i < iterations; i++) {
    const m1 = jdLo + (jdHi - jdLo) / 3;
    const m2 = jdHi - (jdHi - jdLo) / 3;
    if (f(m1) < f(m2)) jdHi = m2;
    else jdLo = m1;
  }
  return (jdLo + jdHi) / 2;
}

function collectNewMoonRefinedJdsAlongAxis(
  jdRef: number,
  getSunMoon: (jd: number) => SunMoonLon,
  direction: -1 | 1
): number[] {
  const sep = (t: number) => moonSunConjunctionSepDeg(t, getSunMoon);
  const step = 0.12;
  const horizon = 38;
  const jds: number[] = [];
  const n = Math.ceil(horizon / step);
  for (let k = 0; k <= n; k++) {
    jds.push(jdRef + direction * k * step);
  }
  const refined: number[] = [];
  for (let i = 1; i < jds.length - 1; i++) {
    const v = sep(jds[i]);
    if (v <= sep(jds[i - 1]) + 1e-6 && v <= sep(jds[i + 1]) + 1e-6 && v < 18) {
      const r = refineMinimumUnimodal(jds[i] - 1.5, jds[i] + 1.5, sep, 55);
      if (refined.length === 0 || Math.abs(r - refined[refined.length - 1]) > 0.45) {
        refined.push(r);
      }
    }
  }
  return refined;
}

/**
 * Six ṛtus from sidereal solar rāśi only (standard pairing of two signs each):
 * 0 Vasanta — Meṣa, Vṛṣabha | 1 Grīṣma — Mithuna, Karka | 2 Varṣa — Siṃha, Kanyā |
 * 3 Śarad — Tulā, Vṛścika | 4 Hemanta — Dhanu, Makara | 5 Śiśira — Kumbha, Mīna.
 * For full panchānga use {@link ruthuvuIndexFromPanchang} so Chaitra with Sun still in Kumbha/Mīna counts as Vasanta.
 */
export function ruthuvuIndexFromSunsign(sunsign: number): number {
  const s = ((sunsign % 12) + 12) % 12;
  return Math.floor(s / 2) % 6;
}

/**
 * Ṛtu index for display: Amanta **Chaitra** (lunar month 0) is **Vasanta** even when the Sun is still
 * sidereal in Kumbha or Mīna (before Meṣa Saṅkrānti). Otherwise use rāśi-based ṛtu from {@link ruthuvuIndexFromSunsign}.
 */
export function ruthuvuIndexFromPanchang(sunsign: number, lunarMonthIndex: number): number {
  if (lunarMonthIndex === 0) return 0;
  return ruthuvuIndexFromSunsign(sunsign);
}

/** Same mapping as legacy UI / festival rules: Mesha→Vaisakha base, … Meena→Chaitra base (0). */
const SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

/**
 * Amanta month label (0 = Chaitra … 11 = Phalguna) matching common Telugu panchang practice.
 * Krishna paksha is shifted back by one month except when Sun is still in Meena during Chaitra
 * (after the March new moon): then the month stays Chaitra until Amavasya.
 */
function amantaLunarMonthIndexFromSunsignPakshaAndNm(
  jdStart: number,
  sunsign: number,
  paksham: number,
  getSunMoon: (jd: number) => SunMoonLon
): number {
  const base = SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH[sunsign] ?? 0;
  if (paksham !== 1) return base;
  if (sunsign === 11) {
    const backward = collectNewMoonRefinedJdsAlongAxis(jdStart, getSunMoon, -1);
    const before = backward.filter((j) => j < jdStart);
    const nmBefore = before.length > 0 ? Math.max(...before) : jdStart - 14.77;
    const dt = julianDayToDate(nmBefore + 0.5);
    if (dt.month === 3) return base;
  }
  return (base + 11) % 12;
}

function weekdayInTz(date: Date, tz: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? date.getUTCDay();
}

const DUR_MUHURTAM_48_MS = 48 * 60 * 1000;
const DUR_MUHURTAM_96_MS = 96 * 60 * 1000;

function durMuhurtamOffsetMs(hours: number, minutes: number): number {
  return (hours * 60 + minutes) * 60 * 1000;
}

/**
 * Durmuhurtam per standard weekday tables: start times measured from suryodayam,
 * except Tuesday’s second period from suryastamaya. Durations 48 min (Saturday 96 min from sunrise).
 */
function durmuhurtamRanges(sunrise: Date, sunset: Date, weekday: number): TimeRange[] {
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  const span = (startMs: number, durationMs: number): TimeRange => ({
    start: new Date(startMs),
    end: new Date(startMs + durationMs),
  });
  const o = durMuhurtamOffsetMs;

  switch (weekday) {
    case 0:
      return [span(sr + o(10, 24), DUR_MUHURTAM_48_MS)];
    case 1:
      return [span(sr + o(6, 24), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 2:
      return [span(sr + o(2, 24), DUR_MUHURTAM_48_MS), span(ss + o(5, 36), DUR_MUHURTAM_48_MS)];
    case 3:
      return [span(sr + o(5, 36), DUR_MUHURTAM_48_MS)];
    case 4:
      return [span(sr + o(4, 0), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 5:
      return [span(sr + o(2, 24), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 6:
      return [span(sr, DUR_MUHURTAM_96_MS)];
    default:
      return [span(sr + o(10, 24), DUR_MUHURTAM_48_MS)];
  }
}

/**
 * Map half-tithi step (0-59) to karana index per Hindu panchang.
 * 7 movable karanas (0-6) repeat 8x; 4 fixed (7-10) appear once each.
 * See: https://en.wikipedia.org/wiki/Karana_(pancanga)
 */
function karanaIndexFromStep(step: number): number {
  const k = ((step % 60) + 60) % 60;
  if (k === 0) return 10; // Kimstughna
  if (k === 57) return 7; // Shakuni
  if (k === 58) return 8; // Chatushpada
  if (k === 59) return 9; // Naga
  return (k - 1) % 7; // Bava, Balava, Kaulava, Taitila, Gara, Vanija, Visti
}

/** Maps API `ayanamsa` query values to Swiss Ephemeris {@link SiderealMode} (default Lahiri). */
const AYANAMSA_BY_ID: Record<string, SiderealMode> = {
  lahiri: SiderealMode.Lahiri,
  faganbradley: SiderealMode.FaganBradley,
  fagan: SiderealMode.FaganBradley,
  deluce: SiderealMode.DeLuce,
  ramani: SiderealMode.Raman,
  raman: SiderealMode.Raman,
  ushashashi: SiderealMode.Ushashashi,
  krishnamurti: SiderealMode.Krishnamurti,
  kp: SiderealMode.Krishnamurti,
  djwhalkhul: SiderealMode.DjwhalKhul,
  yukteshwar: SiderealMode.Yukteshwar,
  jnbhasin: SiderealMode.JNBhasin,
  suryasiddhanta: SiderealMode.SuryaSiddhanta,
  truecitra: SiderealMode.TrueCitra,
  truerevati: SiderealMode.TrueRevati,
};

function setSiderealModeFromQuery(id: string): void {
  const key = id.toLowerCase().trim().replace(/[\s_-]/g, '');
  setSiderealMode(AYANAMSA_BY_ID[key] ?? SiderealMode.Lahiri);
}

function findTransition(
  jdStart: number,
  jdEnd: number,
  getValue: (jd: number) => number,
  currentIndex: number,
  step: number,
  total: number
): number | null {
  const nextIndex = (currentIndex + 1) % total;
  const idxAt = (jd: number) => Math.floor(getValue(jd) / step) % total;
  if (idxAt(jdStart) !== currentIndex) return null;
  let lo = jdStart;
  let hi = jdEnd;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const idx = idxAt(mid);
    if (idx === nextIndex) hi = mid;
    else lo = mid;
  }
  if (hi <= jdStart || hi > jdEnd) return null;
  // Without this check, a window with no transition converges to hi ≈ jdEnd and wrongly
  // returns next sunrise as the "end" of the current segment.
  return idxAt(hi) === nextIndex ? hi : null;
}

function findSegmentStartBackward(
  jdAt: number,
  getValue: (jd: number) => number,
  currentIndex: number,
  step: number,
  total: number
): number {
  let hi = jdAt;
  let lo = jdAt;
  const stepDays = 1 / 24; // 1 hour
  const maxLookbackDays = 3;
  const maxSteps = Math.ceil(maxLookbackDays / stepDays);

  for (let i = 0; i < maxSteps; i++) {
    const probe = hi - stepDays;
    const idx = Math.floor(getValue(probe) / step) % total;
    if (idx !== currentIndex) {
      lo = probe;
      break;
    }
    hi = probe;
    lo = probe;
  }

  // If we never found a non-current segment in lookback, fallback to current instant.
  const loIdx = Math.floor(getValue(lo) / step) % total;
  if (loIdx === currentIndex) return jdAt;

  let left = lo;
  let right = jdAt;
  for (let i = 0; i < 50; i++) {
    const mid = (left + right) / 2;
    const idx = Math.floor(getValue(mid) / step) % total;
    if (idx === currentIndex) right = mid;
    else left = mid;
  }
  return right;
}

export function computePanchang(
  dateStr: string,
  lat: number,
  lon: number,
  tz: string,
  ayanamsa: string = 'lahiri'
): PanchangResult {
  setSiderealModeFromQuery(ayanamsa);

  const { sunrise, sunset } = getSunriseSunset(dateStr, lat, lon, tz);
  const { moonrise, moonset } = getMoonriseMoonset(dateStr, lat, lon, tz);
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use Date.UTC to avoid timezone issues: local Date(y,m,d+1) can yield same calendar day in UTC
  const nextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const { sunrise: nextSunrise } = getSunriseSunset(nextDateStr, lat, lon, tz);

  const jdStart = dateToJulianDay(sunrise);
  const jdEnd = dateToJulianDay(nextSunrise);

  const getSunMoon = (jd: number) => {
    const sun = calculatePosition(jd, Planet.Sun, SIDEREAL_FLAGS);
    const moon = calculatePosition(jd, Planet.Moon, SIDEREAL_FLAGS);
    return { sun: sun.longitude, moon: moon.longitude };
  };

  const tithiValue = (jd: number) => {
    const { sun, moon } = getSunMoon(jd);
    return normalizeLon(moon - sun);
  };
  const nakshatraValue = (jd: number) => {
    const { moon } = getSunMoon(jd);
    return normalizeLon(moon);
  };
  const yogaValue = (jd: number) => {
    const { sun, moon } = getSunMoon(jd);
    return normalizeLon(sun + moon);
  };
  const karanaStepValue = (jd: number) => Math.floor(tithiValue(jd) / 6) % 60;

  const tithiAtStart = Math.floor(tithiValue(jdStart) / TITHI_DEG) % 30;
  const nakshatraAtStart = Math.floor(nakshatraValue(jdStart) / NAKSHATRA_DEG) % 27;
  const yogaAtStart = Math.floor(yogaValue(jdStart) / YOGA_DEG) % 27;
  const karanaStepAtStart = Math.floor(tithiValue(jdStart) / 6) % 60;

  const tithiStartJd = findSegmentStartBackward(jdStart, tithiValue, tithiAtStart, TITHI_DEG, 30);
  const nakshatraStartJd = findSegmentStartBackward(jdStart, nakshatraValue, nakshatraAtStart, NAKSHATRA_DEG, 27);
  const yogaStartJd = findSegmentStartBackward(jdStart, yogaValue, yogaAtStart, YOGA_DEG, 27);

  const tithiEndJd = findTransition(jdStart, jdEnd, tithiValue, tithiAtStart, TITHI_DEG, 30);
  const nakshatraEndJd = findTransition(jdStart, jdEnd, nakshatraValue, nakshatraAtStart, NAKSHATRA_DEG, 27);
  const yogaEndJd = findTransition(jdStart, jdEnd, yogaValue, yogaAtStart, YOGA_DEG, 27);

  const paksham = tithiAtStart < 15 ? 0 : 1;

  const dayDuration = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
  const partDuration = dayDuration / 8;
  const weekday = weekdayInTz(sunrise, tz);

  const { sun: sunLon, moon: moonLon } = getSunMoon(jdStart);
  const moonsign = Math.floor(normalizeLon(moonLon) / 30) % 12;
  const sunsign = Math.floor(normalizeLon(sunLon) / 30) % 12;
  const lunarMonthIndex = amantaLunarMonthIndexFromSunsignPakshaAndNm(jdStart, sunsign, paksham, getSunMoon);
  const ruthuvuIndex = ruthuvuIndexFromPanchang(sunsign, lunarMonthIndex);

  const solarNoonMs = (sunrise.getTime() + sunset.getTime()) / 2;
  const abhijit24MinMs = 24 * 60 * 1000;
  const abhijit: TimeRange = {
    start: new Date(solarNoonMs - abhijit24MinMs),
    end: new Date(solarNoonMs + abhijit24MinMs),
  };

  const brahma96MinMs = 96 * 60 * 1000;
  const brahma48MinMs = 48 * 60 * 1000;
  const brahmaMuhurtam: TimeRange = {
    start: new Date(sunrise.getTime() - brahma96MinMs),
    end: new Date(sunrise.getTime() - brahma48MinMs),
  };

  const amrutaGhadiyalu: TimeRange[] = [];

  const rahuPart = [8, 2, 7, 5, 6, 4, 3][weekday];
  // Yamagandam weekday mapping (1-based day-part index from sunrise):
  // Sun..Sat => 5,4,3,2,1,7,6
  const yamaPart = [5, 4, 3, 2, 1, 7, 6][weekday];
  const gulikaPart = [7, 8, 2, 3, 4, 5, 6][weekday];

  const kaalams: Kaalam[] = [
    { name: 'rahu', part: rahuPart },
    { name: 'yamagandam', part: yamaPart },
    { name: 'gulika', part: gulikaPart },
  ].map(({ name, part }) => {
    const startOffset = (part - 1) * partDuration;
    const start = new Date(sunrise.getTime() + startOffset * 3600 * 1000);
    const end = new Date(start.getTime() + partDuration * 3600 * 1000);
    return { name, start, end };
  });

  const durmuhurtham = durmuhurtamRanges(sunrise, sunset, weekday);

  const nakshatraSegments: { idx: number; startJd: number; endJd: number }[] = [];
  let walkNakIdx = nakshatraAtStart;
  let walkSegStartJd = findSegmentStartBackward(jdStart, nakshatraValue, nakshatraAtStart, NAKSHATRA_DEG, 27);
  while (walkSegStartJd < jdEnd) {
    const walkSegEndJd = findTransition(walkSegStartJd, jdEnd, nakshatraValue, walkNakIdx, NAKSHATRA_DEG, 27) ?? jdEnd;
    nakshatraSegments.push({ idx: walkNakIdx, startJd: walkSegStartJd, endJd: walkSegEndJd });
    if (walkSegEndJd >= jdEnd) break;
    walkSegStartJd = walkSegEndJd;
    walkNakIdx = (walkNakIdx + 1) % 27;
  }

  for (const seg of nakshatraSegments) {
    const segDuration = seg.endJd - seg.startJd;
    if (segDuration <= 0) continue;
    const amritaX = NAKSHATRA_AMRITA_START_HOURS[seg.idx] ?? 0;
    const amritaStartJd = seg.startJd + (amritaX / 24) * segDuration;
    const amritaEndJd = amritaStartJd + AMRITA_DURATION_FACTOR * segDuration;
    const clippedStart = Math.max(jdStart, amritaStartJd);
    const clippedEnd = Math.min(jdEnd, amritaEndJd);
    if (clippedEnd > clippedStart) {
      amrutaGhadiyalu.push({
        start: jdToDate(clippedStart),
        end: jdToDate(clippedEnd),
      });
    }
  }

  const varjamDurationInDays = VARJAM_DURATION_MINUTES / (24 * 60);
  let varjam: TimeRange | null = null;
  for (const seg of nakshatraSegments) {
    const ghatikaOffset = NAKSHATRA_THYAJYA_GHATIKA_OFFSETS[seg.idx] ?? 0;
    const varjamStartJd = seg.startJd + (ghatikaOffset * GHATIKA_MINUTES) / (24 * 60);
    const varjamEndJd = varjamStartJd + varjamDurationInDays;
    const clippedStart = Math.max(jdStart, varjamStartJd);
    const clippedEnd = Math.min(jdEnd, varjamEndJd);
    if (clippedEnd > clippedStart) {
      varjam = { start: jdToDate(clippedStart), end: jdToDate(clippedEnd) };
      break;
    }
  }

  // Build karanas: typically 2 per day (sometimes 3). End times follow sunrise→next sunrise;
  // startTime is the true karana boundary (may be before sunrise).
  const karanas: PanchangElement[] = [];
  let step = karanaStepAtStart;
  let jdFrom = jdStart;
  let segmentStartJd = findSegmentStartBackward(jdStart, karanaStepValue, step, 1, 60);
  while (jdFrom < jdEnd) {
    const karanaEndJd = findTransition(jdFrom, jdEnd, karanaStepValue, step, 1, 60);
    const idx = karanaIndexFromStep(step);
    karanas.push({
      index: idx,
      nameKey: `karana_${idx}`,
      startTime: jdToDate(segmentStartJd),
      endTime: karanaEndJd ? jdToDate(karanaEndJd) : null,
    });
    if (!karanaEndJd) break;
    step = (step + 1) % 60;
    jdFrom = karanaEndJd;
    segmentStartJd = karanaEndJd;
  }

  return {
    date: dateStr,
    sunrise,
    sunset,
    moonrise,
    moonset,
    tithi: {
      index: tithiAtStart,
      nameKey: `tithi_${tithiAtStart}`,
      startTime: jdToDate(tithiStartJd),
      endTime: tithiEndJd ? jdToDate(tithiEndJd) : null,
    },
    nakshatra: {
      index: nakshatraAtStart,
      nameKey: `nakshatra_${nakshatraAtStart}`,
      startTime: jdToDate(nakshatraStartJd),
      endTime: nakshatraEndJd ? jdToDate(nakshatraEndJd) : null,
    },
    yoga: {
      index: yogaAtStart,
      nameKey: `yoga_${yogaAtStart}`,
      startTime: jdToDate(yogaStartJd),
      endTime: yogaEndJd ? jdToDate(yogaEndJd) : null,
    },
    karanas,
    kaalams,
    vara: weekday,
    paksham,
    moonsign,
    sunsign,
    lunarMonthIndex,
    ruthuvuIndex,
    abhijit,
    brahmaMuhurtam,
    amrutaGhadiyalu,
    varjam,
    durmuhurtham,
  };
}
