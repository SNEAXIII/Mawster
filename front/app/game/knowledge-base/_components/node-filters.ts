// War-map node grouping for the grid column filters (client-side only).
// Tiers split the 50 nodes contiguously; minibosses sit at 39-43 (inside "Mini boss"),
// bosses at 47-50. Paths run through tiers 1-2 only, 4 nodes each:
// path p = p, p+9, p+18, p+27 (e.g. path 1 = 1,10,19,28; path 9 = 9,18,27,36).

export const SECTIONS = [1, 2, 3, 4] as const;
export const PATHS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const SECTION_RANGES: Record<number, [number, number]> = {
  1: [1, 18],
  2: [19, 36],
  3: [37, 46],
  4: [47, 50],
};

// Paths only make sense inside tiers 1-2 (nodes 1-36), so the path filter is offered only
// when no tier is selected, or tier 1 or 2.
export function pathsAvailable(section: number | null): boolean {
  return section === null || section === 1 || section === 2;
}

export function nodesForPath(path: number): number[] {
  return [path, path + 9, path + 18, path + 27];
}

// The 50 nodes narrowed by the active tier and/or path (intersection).
// `null` on either axis means "no filter" on that axis.
export function visibleNodes(section: number | null, path: number | null): number[] {
  let nodes = Array.from({ length: 50 }, (_, i) => i + 1);
  if (section !== null) {
    const [lo, hi] = SECTION_RANGES[section];
    nodes = nodes.filter((n) => n >= lo && n <= hi);
  }
  if (path !== null) {
    const set = new Set(nodesForPath(path));
    nodes = nodes.filter((n) => set.has(n));
  }
  return nodes;
}
