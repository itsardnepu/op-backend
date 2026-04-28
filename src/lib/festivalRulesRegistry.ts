export type FestivalCategory = 'important' | 'auspicious';

export interface FestivalContext {
  dateStr: string;
  tithi: number;
  paksha: number; // 0 = Shukla, 1 = Krishna
  nakshatra: number;
  vara: number; // 0 = Sunday ... 6 = Saturday
  /** Sun rashi 0–11 at sunrise (Mesha..Meena) */
  sunsign: number;
  /** Amanta lunar month 0 = Chaitra … 11 = Phalguna (from PanchangResult) */
  lunarMonthIndex: number;
  /** Sun rashi at sunrise on the previous civil day; null if unknown (skips solar ingress rules) */
  previousSunsign: number | null;
}

export interface FestivalRule {
  id: string;
  category: FestivalCategory;
  applies: (ctx: FestivalContext) => boolean;
}

/**
 * Legacy Amanta month from sun sign + paksha (approximate; wrong near some boundaries).
 * Kept for test fixtures only when `lunarMonthIndex` is not overridden.
 */
export function lunarMonthIndexFromSunsignPaksha(sunsign: number, paksha: number): number {
  const sunSignToLunarMonthIdx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  const base = sunSignToLunarMonthIdx[sunsign] ?? 0;
  return paksha === 1 ? (base + 11) % 12 : base;
}

/** True if Sun (at sunrise) entered sidereal sign `target` since yesterday’s sunrise */
function sunEnteredSign(previousSunsign: number | null, current: number, target: number): boolean {
  if (previousSunsign === null) return false;
  const expectedPrev = (target + 11) % 12;
  return previousSunsign === expectedPrev && current === target;
}

/**
 * Telugu Amanta–style festival markers (tithi indices 0–29: Shukla 0–14, Krishna 15–29).
 * Solar: Makara Sankranti only (Sun enters Makara). Other sankrantis omitted per product list.
 */
export const FESTIVAL_RULES: FestivalRule[] = [
  {
    id: 'makarSankranti',
    category: 'important',
    applies: ({ sunsign, previousSunsign }) => sunEnteredSign(previousSunsign, sunsign, 9),
  },
  {
    id: 'mahaShivaratri',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 10 && paksha === 1 && tithi === 28,
  },
  {
    id: 'holikaDahan',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 11 && paksha === 0 && tithi === 14,
  },
  {
    id: 'holiRangwali',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 11 && paksha === 1 && tithi === 15,
  },
  {
    id: 'ugadi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 0 && paksha === 0 && tithi === 0,
  },
  {
    id: 'dolaGowriAndolanaTrutiya',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 0 && paksha === 0 && tithi === 2,
  },
  {
    id: 'ramaNavami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 0 && paksha === 0 && tithi === 8,
  },
  {
    id: 'akshayaTritiya',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 1 && paksha === 0 && tithi === 2,
  },
  {
    id: 'hanumanJayanti',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 1 && paksha === 1 && tithi === 24,
  },
  {
    id: 'guruPurnima',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 3 && paksha === 0 && tithi === 14,
  },
  {
    id: 'rakshaBandhan',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 4 && paksha === 0 && tithi === 14,
  },
  {
    id: 'varalakshmiVratam',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex, vara }) =>
      lunarMonthIndex === 4 && paksha === 0 && vara === 5 && tithi >= 10 && tithi <= 13,
  },
  {
    id: 'janmashtami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 4 && paksha === 1 && tithi === 22,
  },
  {
    id: 'ganeshChaturthi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 5 && paksha === 0 && tithi === 3,
  },
  {
    id: 'navratriBegins',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 0 && tithi === 0,
  },
  {
    id: 'durgaAshtami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 0 && tithi === 7,
  },
  {
    id: 'mahaNavami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 0 && tithi === 8,
  },
  {
    id: 'vijayadashami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 0 && tithi === 9,
  },
  {
    id: 'atlaTadde',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 1 && tithi === 17,
  },
  {
    id: 'karvaChauth',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 1 && tithi === 18,
  },
  {
    id: 'deepavali',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 6 && paksha === 1 && tithi === 29,
  },
  {
    id: 'nagulaChavithi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 7 && paksha === 0 && tithi === 3,
  },
  {
    id: 'nagaPanchami',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 8 && paksha === 0 && tithi === 4,
  },
  {
    id: 'mokshadaEkadashi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 8 && paksha === 0 && tithi === 10,
  },
  {
    id: 'mokshadaDwadashi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 8 && paksha === 0 && tithi === 11,
  },
  {
    id: 'kurmaDwadashi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 9 && paksha === 0 && tithi === 11,
  },
  {
    id: 'bhishmaDwadashi',
    category: 'important',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      lunarMonthIndex === 10 && paksha === 0 && tithi === 11,
  },
  {
    id: 'shaniTrayodashi',
    category: 'auspicious',
    applies: ({ vara, tithi }) => vara === 6 && (tithi === 12 || tithi === 27),
  },
  {
    id: 'pradosha',
    category: 'auspicious',
    applies: ({ tithi }) => tithi === 12 || tithi === 27,
  },
  {
    id: 'purnima',
    category: 'auspicious',
    applies: ({ tithi, paksha }) => paksha === 0 && tithi === 14,
  },
  {
    id: 'shuklaEkadashi',
    category: 'auspicious',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      paksha === 0 && tithi === 10 && lunarMonthIndex !== 8,
  },
  {
    id: 'krishnaEkadashi',
    category: 'auspicious',
    applies: ({ tithi, paksha }) => paksha === 1 && tithi === 25,
  },
  {
    id: 'amavasya',
    category: 'auspicious',
    applies: ({ tithi, paksha, lunarMonthIndex }) =>
      paksha === 1 && tithi === 29 && lunarMonthIndex !== 6,
  },
];
