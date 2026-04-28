import type { PanchangResult } from '../lib/panchang.js';
import { ruthuvuIndexFromPanchang } from '../lib/panchang.js';
import type { FestivalContext } from '../lib/festivalRulesRegistry.js';
import { lunarMonthIndexFromSunsignPaksha } from '../lib/festivalRulesRegistry.js';

/** Panchang fields used to build a test result; optional `lunarMonthIndex` overrides legacy sun+paksha mapping. */
export type FestivalFixtureInput = Omit<FestivalContext, 'previousSunsign' | 'lunarMonthIndex'> & {
  lunarMonthIndex?: number;
};

function baseResult(ctx: FestivalFixtureInput): PanchangResult {
  const baseDate = new Date(`${ctx.dateStr}T00:00:00.000Z`);
  const plus = (min: number) => new Date(baseDate.getTime() + min * 60 * 1000);
  const lunarMonthIndex = ctx.lunarMonthIndex ?? lunarMonthIndexFromSunsignPaksha(ctx.sunsign, ctx.paksha);
  return {
    date: ctx.dateStr,
    sunrise: plus(360),
    sunset: plus(1080),
    moonrise: plus(400),
    moonset: plus(900),
    tithi: { index: ctx.tithi, nameKey: `tithi_${ctx.tithi}`, startTime: plus(200), endTime: plus(800) },
    nakshatra: { index: ctx.nakshatra, nameKey: `nak_${ctx.nakshatra}`, startTime: plus(220), endTime: plus(820) },
    yoga: { index: 0, nameKey: 'yoga_0', startTime: plus(240), endTime: plus(840) },
    karanas: [],
    kaalams: [],
    vara: ctx.vara,
    paksham: ctx.paksha,
    moonsign: 0,
    sunsign: ctx.sunsign,
    lunarMonthIndex,
    ruthuvuIndex: ruthuvuIndexFromPanchang(ctx.sunsign, lunarMonthIndex),
    abhijit: { start: plus(700), end: plus(748) },
    brahmaMuhurtam: { start: plus(264), end: plus(312) },
    amrutaGhadiyalu: [],
    varjam: null,
    durmuhurtham: [{ start: plus(620), end: plus(668) }],
  };
}

export interface FestivalFixture {
  label: string;
  input: FestivalFixtureInput;
  previousSunsign?: number | null;
  expectedIds: string[];
}

export const FESTIVAL_FIXTURES: FestivalFixture[] = [
  {
    label: 'Makar Sankranti (Sun entered Makara)',
    input: { dateStr: '2026-01-15', tithi: 0, paksha: 0, nakshatra: 0, vara: 0, sunsign: 9 },
    previousSunsign: 8,
    expectedIds: ['makarSankranti'],
  },
  {
    label: 'Ugadi (Chaitra Shukla Pratipada)',
    input: { dateStr: '2026-03-20', tithi: 0, paksha: 0, nakshatra: 0, vara: 5, sunsign: 11, lunarMonthIndex: 0 },
    expectedIds: ['ugadi'],
  },
  {
    label: 'Rama Navami (Chaitra Shukla Navami)',
    input: { dateStr: '2026-03-28', tithi: 8, paksha: 0, nakshatra: 2, vara: 5, sunsign: 0, lunarMonthIndex: 0 },
    expectedIds: ['ramaNavami'],
  },
  {
    label: 'Deepavali (Ashvina Krishna Amavasya)',
    input: { dateStr: '2026-11-08', tithi: 29, paksha: 1, nakshatra: 10, vara: 0, sunsign: 6, lunarMonthIndex: 6 },
    expectedIds: ['deepavali'],
  },
  {
    label: 'Maha Shivaratri (Magha Krishna Chaturdashi)',
    input: { dateStr: '2026-02-15', tithi: 28, paksha: 1, nakshatra: 0, vara: 0, sunsign: 10, lunarMonthIndex: 10 },
    expectedIds: ['mahaShivaratri'],
  },
  {
    label: 'Mokshada Ekadashi (Margashira Shukla Ekadashi; not generic Shukla Ekadashi label)',
    input: { dateStr: '2026-12-21', tithi: 10, paksha: 0, nakshatra: 0, vara: 0, sunsign: 8, lunarMonthIndex: 8 },
    expectedIds: ['mokshadaEkadashi'],
  },
  {
    label: 'Shukla Ekadashi (non-Margashira)',
    input: { dateStr: '2026-05-28', tithi: 10, paksha: 0, nakshatra: 0, vara: 0, sunsign: 1, lunarMonthIndex: 1 },
    expectedIds: ['shuklaEkadashi'],
  },
  {
    label: 'Shani Trayodashi + Pradosha on Saturday Trayodashi',
    input: { dateStr: '2026-06-06', tithi: 12, paksha: 0, nakshatra: 0, vara: 6, sunsign: 2, lunarMonthIndex: 2 },
    expectedIds: ['shaniTrayodashi', 'pradosha'],
  },
  {
    label: 'Amavasya (non–Deepavali Ashvina)',
    input: { dateStr: '2026-07-01', tithi: 29, paksha: 1, nakshatra: 0, vara: 3, sunsign: 2, lunarMonthIndex: 3 },
    expectedIds: ['amavasya'],
  },
];

export function fixtureToResult(ctx: FestivalFixtureInput): PanchangResult {
  return baseResult(ctx);
}
