import type { PanchangResult } from './panchang.js';
import {
  FESTIVAL_RULES,
  type FestivalCategory,
  type FestivalContext,
} from './festivalRulesRegistry.js';

export interface FestivalItem {
  id: string;
  name: string;
  category: FestivalCategory;
  /** ISO instant (minute-rounded) when the ruling tithi began; omitted for solar-only markers */
  tithiStart?: string | null;
  /** ISO instant when the ruling tithi ends; null if unknown past this day */
  tithiEnd?: string | null;
  /** True when `tithiStart` falls on the civil calendar day before `dateStr` in `timeZone` */
  tithiStartedPriorCivilDay?: boolean;
  /** True when merged from the prior Vedic day because that sunrise’s tithi extended past today’s sunrise */
  carriedFromPriorVedicDay?: boolean;
  /** Ruling tithi for this marker begins later on the same civil `dateStr` (after sunrise), e.g. Akshaya Tritiya starting mid‑morning */
  tithiStartsLaterSameCivilDay?: boolean;
}

/** Festivals determined only by solar ingress (no single tithi window). */
const SOLAR_FESTIVAL_IDS = new Set(['makarSankranti']);

/** Core fields required for festival detection (matches upstream `core` JSON). */
export type FestivalCoreLike = Pick<
  PanchangResult,
  'tithi' | 'paksham' | 'vara' | 'sunsign' | 'lunarMonthIndex' | 'nakshatra' | 'sunrise'
> &
  Partial<Pick<PanchangResult, 'date'>>

function roundToMinuteUtc(d: Date): Date {
  return new Date(Math.round(d.getTime() / 60000) * 60000)
}

function toIsoMinuteUtc(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return roundToMinuteUtc(d).toISOString()
}

function parseInstant(v: unknown): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Next tithi index / paksha / Amanta month after the current tithi segment ends. */
export function advanceTithiAmanta(
  tithiIndex: number,
  paksham: number,
  lunarMonthIndex: number
): { tithi: number; paksham: number; lunarMonthIndex: number } {
  if (tithiIndex === 29) {
    return { tithi: 0, paksham: 0, lunarMonthIndex: (lunarMonthIndex + 1) % 12 }
  }
  if (tithiIndex === 14) {
    return { tithi: 15, paksham: 1, lunarMonthIndex }
  }
  return { tithi: (tithiIndex + 1) % 30, paksham, lunarMonthIndex }
}

function varaAtInstantInTz(d: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(d)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[short] ?? 0
}

function civilDateKeyInTz(iso: string, timeZone: string): string | null {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (y == null || m == null || day == null) return null
    return `${y}-${m}-${day}`
  } catch {
    return null
  }
}

function enrichWithTithiWindow(
  items: FestivalItem[],
  core: FestivalCoreLike,
  dateStr: string,
  timeZone: string,
  carriedFromPriorVedicDay: boolean,
  opts?: { tithiStartsLaterSameCivilDay?: boolean; segmentStartOverride?: unknown; segmentEndOverride?: unknown }
): FestivalItem[] {
  const startIso = toIsoMinuteUtc(opts?.segmentStartOverride ?? core.tithi?.startTime)
  const endIso = toIsoMinuteUtc(opts?.segmentEndOverride ?? core.tithi?.endTime)
  const prior =
    startIso != null ? (civilDateKeyInTz(startIso, timeZone) ?? '') < dateStr : false
  const later = opts?.tithiStartsLaterSameCivilDay === true
  return items.map((f) => {
    if (SOLAR_FESTIVAL_IDS.has(f.id)) {
      return {
        ...f,
        tithiStart: null,
        tithiEnd: null,
        ...(carriedFromPriorVedicDay ? { carriedFromPriorVedicDay: true } : {}),
      }
    }
    return {
      ...f,
      tithiStart: startIso,
      tithiEnd: endIso,
      ...(prior ? { tithiStartedPriorCivilDay: true } : {}),
      ...(carriedFromPriorVedicDay ? { carriedFromPriorVedicDay: true } : {}),
      ...(later ? { tithiStartsLaterSameCivilDay: true } : {}),
    }
  })
}

/** End instant of the segment with tithi index `segmentTithiIndex`, using the following day’s sunrise snapshot. */
function inferSegmentEndFromNextCore(segmentTithiIndex: number, nextCore: FestivalCoreLike): string | null {
  const nextIdx = nextCore.tithi?.index
  if (nextIdx === undefined) return null
  // Next sunrise is still in the same tithi segment → use that row’s end time.
  if (nextIdx === segmentTithiIndex) {
    return toIsoMinuteUtc(nextCore.tithi.endTime)
  }
  // Otherwise the segment ends when the next tithi at sunrise begins.
  return toIsoMinuteUtc(nextCore.tithi.startTime)
}

/**
 * Detect festivals for `dateStr`, attach the ruling tithi’s start/end (location `timeZone` civil-day hints),
 * and merge markers from the **previous** panchang day when that day’s sunrise tithi segment extends past
 * today’s sunrise (so a tithi that began the prior civil evening is still surfaced).
 *
 * When the **next** tithi begins on the same civil `dateStr` (after sunrise) but sunrise was still on the
 * previous tithi, we re‑evaluate rules at that transition (e.g. Akshaya Tritiya starting mid‑morning) and merge;
 * `nextResult` should be the core for `dateStr + 1` calendar day to infer segment end times.
 */
export function buildFestivalsForDay(params: {
  dateStr: string
  timeZone: string
  lang: 'te' | 'en'
  result: FestivalCoreLike
  previousSunsign: number | null
  prevResult?: FestivalCoreLike | null
  prevDateStr?: string
  previousSunsignForPrevDay?: number | null
  nextResult?: FestivalCoreLike | null
}): FestivalItem[] {
  const {
    dateStr,
    timeZone,
    lang,
    result,
    previousSunsign,
    prevResult,
    prevDateStr,
    previousSunsignForPrevDay,
    nextResult,
  } = params

  const currentRaw = detectFestivalsRaw(dateStr, result, previousSunsign)
  const names = getFestivalNames(lang)
  const toItems = (raw: ReturnType<typeof detectFestivalsRaw>): FestivalItem[] =>
    raw.map((r) => ({ id: r.id, name: names[r.id] || r.id, category: r.category }))

  const map = new Map<string, FestivalItem>()
  for (const f of enrichWithTithiWindow(toItems(currentRaw), result, dateStr, timeZone, false)) {
    map.set(f.id, f)
  }

  if (prevResult && prevDateStr) {
    const sunriseToday = parseInstant(result.sunrise)
    const prevTithiEnd = parseInstant(prevResult.tithi?.endTime)
    if (sunriseToday && prevTithiEnd && prevTithiEnd.getTime() > sunriseToday.getTime()) {
      const prevRaw = detectFestivalsRaw(prevDateStr, prevResult, previousSunsignForPrevDay ?? null)
      for (const f of enrichWithTithiWindow(toItems(prevRaw), prevResult, dateStr, timeZone, true)) {
        if (!map.has(f.id)) map.set(f.id, f)
      }
    }
  }

  const firstBoundary = parseInstant(result.tithi?.endTime)
  const firstBoundaryKey =
    firstBoundary != null ? civilDateKeyInTz(toIsoMinuteUtc(firstBoundary)!, timeZone) : null
  if (firstBoundary && firstBoundaryKey === dateStr && nextResult) {
    const adv = advanceTithiAmanta(result.tithi.index, result.paksham, result.lunarMonthIndex)
    const varaAt = varaAtInstantInTz(firstBoundary, timeZone)
    const forwardRaw = detectFestivalsFromContext({
      dateStr,
      tithi: adv.tithi,
      paksha: adv.paksham,
      nakshatra: result.nakshatra.index,
      vara: varaAt,
      sunsign: result.sunsign,
      lunarMonthIndex: adv.lunarMonthIndex,
      previousSunsign: previousSunsign ?? null,
    }).filter((r) => !SOLAR_FESTIVAL_IDS.has(r.id))
    const segEndIso = inferSegmentEndFromNextCore(adv.tithi, nextResult)
    for (const f of enrichWithTithiWindow(toItems(forwardRaw), result, dateStr, timeZone, false, {
      tithiStartsLaterSameCivilDay: true,
      segmentStartOverride: result.tithi.endTime,
      segmentEndOverride: segEndIso,
    })) {
      map.set(f.id, f)
    }

    /** Further tithi changes still on the same civil day (e.g. rare short tithis). */
    let walkIdx = adv.tithi
    let walkPak = adv.paksham
    let walkMonth = adv.lunarMonthIndex
    let walkSegEnd = segEndIso != null ? parseInstant(segEndIso) : null
    for (let step = 0; step < 4 && walkSegEnd; step++) {
      const endKey = civilDateKeyInTz(toIsoMinuteUtc(walkSegEnd)!, timeZone)
      if (endKey !== dateStr) break
      const nextAdv = advanceTithiAmanta(walkIdx, walkPak, walkMonth)
      const nextStart = walkSegEnd
      const vara2 = varaAtInstantInTz(nextStart, timeZone)
      const raw2 = detectFestivalsFromContext({
        dateStr,
        tithi: nextAdv.tithi,
        paksha: nextAdv.paksham,
        nakshatra: result.nakshatra.index,
        vara: vara2,
        sunsign: result.sunsign,
        lunarMonthIndex: nextAdv.lunarMonthIndex,
        previousSunsign: previousSunsign ?? null,
      }).filter((r) => !SOLAR_FESTIVAL_IDS.has(r.id))
      const end2 = inferSegmentEndFromNextCore(nextAdv.tithi, nextResult)
      for (const f of enrichWithTithiWindow(toItems(raw2), result, dateStr, timeZone, false, {
        tithiStartsLaterSameCivilDay: true,
        segmentStartOverride: walkSegEnd,
        segmentEndOverride: end2,
      })) {
        map.set(f.id, f)
      }
      walkIdx = nextAdv.tithi
      walkPak = nextAdv.paksham
      walkMonth = nextAdv.lunarMonthIndex
      walkSegEnd = end2 != null ? parseInstant(end2) : null
    }
  }

  return [...map.values()]
}

type RawFestival = { id: string; category: FestivalCategory }

function detectFestivalsFromContext(ctx: FestivalContext): RawFestival[] {
  return FESTIVAL_RULES.filter((rule) => rule.applies(ctx)).map((rule) => ({
    id: rule.id,
    category: rule.category,
  }))
}

function detectFestivalsRaw(dateStr: string, result: FestivalCoreLike, previousSunsign: number | null): RawFestival[] {
  return detectFestivalsFromContext({
    dateStr,
    tithi: result.tithi.index,
    paksha: result.paksham,
    nakshatra: result.nakshatra.index,
    vara: result.vara,
    sunsign: result.sunsign,
    lunarMonthIndex: result.lunarMonthIndex,
    previousSunsign: previousSunsign ?? null,
  })
}

type Lang = 'te' | 'en';

function getFestivalNames(lang: Lang): Record<string, string> {
  if (lang === 'te') {
    return {
      makarSankranti: 'మకర సంక్రాంతి (సూర్యుడు మకర రాశిలోకి)',
      mahaShivaratri: 'మహా శివరాత్రి',
      holikaDahan: 'హోలికా దహనం (ఫాల్గుణ శుక్ల పౌర్ణమి)',
      holiRangwali: 'రంగవల్లి హోలీ (ఫాల్గుణ కృష్ణ పాడ్యమి)',
      ugadi: 'ఉగాది',
      dolaGowriAndolanaTrutiya: 'దోల గౌరి / ఆందోళన తృతీయ',
      ramaNavami: 'శ్రీరామ నవమి',
      akshayaTritiya: 'అక్షయ తృతీయ',
      hanumanJayanti: 'హనుమాన్ జయంతి',
      guruPurnima: 'గురు పౌర్ణమి',
      rakshaBandhan: 'రక్షా బంధన్',
      varalakshmiVratam: 'వరలక్ష్మి వ్రతం',
      janmashtami: 'శ్రీకృష్ణ జన్మాష్టమి',
      ganeshChaturthi: 'వినాయక చవితి',
      navratriBegins: 'నవరాత్రుల ప్రారంభం',
      durgaAshtami: 'దుర్గాష్టమి',
      mahaNavami: 'మహా నవమి',
      vijayadashami: 'విజయదశమి / దసరా',
      atlaTadde: 'అట్ల తద్ది',
      karvaChauth: 'కర్వా చౌత్',
      deepavali: 'దీపావళి / లక్ష్మీ పూజ',
      nagulaChavithi: 'నాగుల చవితి',
      nagaPanchami: 'నాగ పంచమి',
      mokshadaEkadashi: 'మోక్షద ఏకాదశి',
      mokshadaDwadashi: 'మోక్షద ద్వాదశి',
      kurmaDwadashi: 'కూర్మ ద్వాదశి',
      bhishmaDwadashi: 'భీష్మ ద్వాదశి',
      shaniTrayodashi: 'శని త్రయోదశి',
      pradosha: 'ప్రదోష వ్రతం',
      purnima: 'పౌర్ణమి',
      shuklaEkadashi: 'శుక్ల ఏకాదశి',
      krishnaEkadashi: 'కృష్ణ ఏకాదశి',
      amavasya: 'అమావాస్య',
    };
  }
  return {
    makarSankranti: 'Makar Sankranti (Sun enters Makara)',
    mahaShivaratri: 'Maha Shivaratri',
    holikaDahan: 'Holika Dahan (Phalguna Shukla Purnima)',
    holiRangwali: 'Rangwali Holi (Phalguna Krishna Pratipada)',
    ugadi: 'Ugadi',
    dolaGowriAndolanaTrutiya: 'Dola Gowri Vratam / Andolana Trutiya',
    ramaNavami: 'Rama Navami',
    akshayaTritiya: 'Akshaya Tritiya',
    hanumanJayanti: 'Hanuman Jayanti',
    guruPurnima: 'Guru Purnima',
    rakshaBandhan: 'Raksha Bandhan',
    varalakshmiVratam: 'Varalakshmi Vratam',
    janmashtami: 'Krishna Janmashtami',
    ganeshChaturthi: 'Ganesh Chaturthi',
    navratriBegins: 'Navratri begins',
    durgaAshtami: 'Durga Ashtami',
    mahaNavami: 'Maha Navami',
    vijayadashami: 'Vijayadashami / Dussehra',
    atlaTadde: 'Atla Tadde',
    karvaChauth: 'Karva Chauth',
    deepavali: 'Deepavali / Lakshmi Puja',
    nagulaChavithi: 'Nagula Chavithi',
    nagaPanchami: 'Naga Panchami (Telugu regional)',
    mokshadaEkadashi: 'Mokshada Ekadashi',
    mokshadaDwadashi: 'Mokshada Dwadashi',
    kurmaDwadashi: 'Kurma Dwadashi',
    bhishmaDwadashi: 'Bhishma Dwadashi',
    shaniTrayodashi: 'Shani Trayodashi',
    pradosha: 'Pradosh Vratam',
    purnima: 'Purnima',
    shuklaEkadashi: 'Shukla Ekadashi',
    krishnaEkadashi: 'Krishna Ekadashi',
    amavasya: 'Amavasya',
  };
}

/** @deprecated Prefer {@link buildFestivalsForDay} for API responses (tithi windows + carry). */
export function detectFestivals(
  dateStr: string,
  result: PanchangResult,
  lang: Lang,
  previousSunsign?: number | null
): FestivalItem[] {
  return buildFestivalsForDay({
    dateStr,
    timeZone: 'UTC',
    lang,
    result,
    previousSunsign: previousSunsign ?? null,
  })
}
