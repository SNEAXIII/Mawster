import type { SeasonFormat } from '@/app/services/season';

export interface MapSection {
  label: string;
  color: string;
  borderColor: string;
  nodeColor: string;
  nodeHoverColor: string;
  // 0 = spacer placeholder
  rows: number[][];
}

// Regular 50-node AW map (boss at top → start at bottom).
export const REGULAR_MAP_SECTIONS: MapSection[] = [
  {
    label: 'Boss',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-600',
    nodeColor: 'border-yellow-500 bg-yellow-950/40',
    nodeHoverColor: 'hover:bg-yellow-900/60',
    rows: [[50], [48, 49], [46, 47]],
  },
  {
    label: 'Mini Boss',
    color: 'text-blue-400',
    borderColor: 'border-blue-600',
    nodeColor: 'border-blue-500 bg-blue-950/40',
    nodeHoverColor: 'hover:bg-blue-900/60',
    rows: [
      [43, 44, 45],
      [40, 41, 42, 0, 37, 38, 39],
    ],
  },
  {
    label: 'Tier 2',
    color: 'text-purple-400',
    borderColor: 'border-purple-600',
    nodeColor: 'border-purple-500 bg-purple-950/40',
    nodeHoverColor: 'hover:bg-purple-900/60',
    rows: [
      [28, 29, 30, 0, 31, 32, 33, 0, 34, 35, 36],
      [19, 20, 21, 0, 22, 23, 24, 0, 25, 26, 27],
    ],
  },
  {
    label: 'Tier 1',
    color: 'text-red-400',
    borderColor: 'border-red-600',
    nodeColor: 'border-red-500 bg-red-950/40',
    nodeHoverColor: 'hover:bg-red-900/60',
    rows: [
      [10, 11, 12, 0, 13, 14, 15, 0, 16, 17, 18],
      [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9],
    ],
  },
];

// Big Thing: a simple flat grid of nodes 1..10, no boss/mini-boss zones.
export const BIG_THING_MAP_SECTIONS: MapSection[] = [
  {
    label: 'Tier 3',
    color: 'text-blue-400',
    borderColor: 'border-blue-600',
    nodeColor: 'border-blue-500 bg-blue-950/40',
    nodeHoverColor: 'hover:bg-blue-900/60',
    rows: [[9, 10]],
  },
  {
    label: 'Tier 2',
    color: 'text-purple-400',
    borderColor: 'border-purple-600',
    nodeColor: 'border-purple-500 bg-purple-950/40',
    nodeHoverColor: 'hover:bg-purple-900/60',
    rows: [[5, 6,  0, 0, 7, 8]],
  },
  {
    label: 'Tier 1',
    color: 'text-red-400',
    borderColor: 'border-red-600',
    nodeColor: 'border-red-500 bg-red-950/40',
    nodeHoverColor: 'hover:bg-red-900/60',
    rows: [[1, 2, 0, 0, 3, 4]],
  },
];

export function mapSectionsForFormat(format: SeasonFormat): MapSection[] {
  return format === 'regular' ? REGULAR_MAP_SECTIONS : BIG_THING_MAP_SECTIONS;
}
