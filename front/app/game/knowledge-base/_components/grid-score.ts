// Heat scale for a combined matchup score. In a fully-rated grid cell the score is always
// 2–4 (each axis ok=1 / good=2): orange (2) → light green (3) → dark green (4); anything
// else stays neutral. Shared by the attacker grid and the defender (mirror) grid.
export function scoreClass(score: number | null): string {
  if (score === null) return 'bg-muted text-foreground'
  if (score >= 4) return 'bg-green-700 text-white'
  if (score === 3) return 'bg-green-500 text-white'
  if (score === 2) return 'bg-orange-500 text-white'
  return 'bg-muted text-foreground'
}

export const SCORE_BADGE_CLASS =
  'inline-block min-w-6 rounded px-1.5 py-0.5 text-center font-semibold'
