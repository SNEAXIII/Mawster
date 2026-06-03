import type { SeasonFormat } from '@/app/services/season';

export interface MapSection {
  label: string;
  color: string;
  borderColor: string;
  // 0 = spacer placeholder
  rows: number[][];
}

// Regular 50-node AW map (boss at top → start at bottom).
export const REGULAR_MAP_SECTIONS: MapSection[] = [
  { label: 'Boss', color: 'text-yellow-400', borderColor: 'border-yellow-600', rows: [[50], [48, 49], [46, 47]] },
  { label: 'Mini Boss', color: 'text-blue-400', borderColor: 'border-blue-600', rows: [[43, 44, 45], [40, 41, 42, 0, 37, 38, 39]] },
  { label: 'Tier 2', color: 'text-purple-400', borderColor: 'border-purple-600', rows: [[28, 29, 30, 0, 31, 32, 33, 0, 34, 35, 36], [19, 20, 21, 0, 22, 23, 24, 0, 25, 26, 27]] },
  { label: 'Tier 1', color: 'text-red-400', borderColor: 'border-red-600', rows: [[10, 11, 12, 0, 13, 14, 15, 0, 16, 17, 18], [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9]] },
];

// Big Thing: a simple flat grid of nodes 1..10, no boss/mini-boss zones.
export const BIG_THING_MAP_SECTIONS: MapSection[] = [
  {
    label: 'Big Thing',
    color: 'text-foreground',
    borderColor: 'border-border',
    rows: [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ],
  },
];

export function mapSectionsForFormat(format: SeasonFormat): MapSection[] {
  return format === 'big_thing' ? BIG_THING_MAP_SECTIONS : REGULAR_MAP_SECTIONS;
}
