// War-map node grouping for the grid column filter (client-side only).
// Sections split the 50 nodes contiguously; minibosses sit at 39-43 (inside S3),
// bosses at 47-50 (S4). Paths run through sections 1-2 only, 4 nodes each:
// path p = p, p+9, p+18, p+27 (e.g. path 1 = 1,10,19,28; path 9 = 9,18,27,36).
//
// Section and path are merged into ONE filter value, so they are mutually exclusive:
//   'all' | 'section-<1..4>' | 'path-<1..9>'.

export const ALL_NODES = 'all';
export const SECTIONS = [1, 2, 3, 4] as const;
export const PATHS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const SECTION_RANGES: Record<number, [number, number]> = {
  1: [1, 18],
  2: [19, 36],
  3: [37, 46],
  4: [47, 50],
};

export function nodesForPath(path: number): number[] {
  return [path, path + 9, path + 18, path + 27];
}

// The 50 nodes narrowed by the merged filter value ('all' returns every node).
export function visibleNodes(filter: string): number[] {
  const all = Array.from({ length: 50 }, (_, i) => i + 1);
  const [kind, raw] = filter.split('-');
  const n = Number(raw);
  if (kind === 'section' && SECTION_RANGES[n]) {
    const [lo, hi] = SECTION_RANGES[n];
    return all.filter((x) => x >= lo && x <= hi);
  }
  if (kind === 'path' && n >= 1 && n <= 9) {
    const set = new Set(nodesForPath(n));
    return all.filter((x) => set.has(x));
  }
  return all;
}
