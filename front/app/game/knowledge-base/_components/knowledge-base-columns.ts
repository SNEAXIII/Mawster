/**
 * Column definitions for the knowledge-base history table, shared by the header
 * row and the record rows so both stay in the same order.
 */

/** Labels the columns need — structurally satisfied by `t.game.knowledgeBase`. */
export interface KnowledgeBaseColumnLabels {
  player: string
  attacker: string
  defender: string
  synergies: string
  prefights: string
  node: string
  ko: string
  alliance: string
  season: string
  tier: string
  date: string
  note: string
}

export interface KnowledgeBaseColumn {
  id: string
  /** Backend sort key, or `null` for a column that cannot be sorted. */
  col: string | null
  label: string
  compact?: boolean
  /** Soaks up whatever width the compact columns left behind. */
  grow?: boolean
}

/**
 * Shrink-to-content column. `w-px` on an auto-layout table means "as narrow as
 * the content allows" — without it `w-full` spreads the leftover width evenly
 * and the portrait columns end up mostly padding.
 */
export const COMPACT_COL = 'w-px px-1 text-center'

/**
 * The one column that stretches. `max-w-0` looks odd but it is what makes the
 * long notes truncate instead of widening the column past the table.
 *
 * `min-w-48` is the floor that keeps it readable: once the compact columns fill
 * the container on their own there is no leftover width to soak up, and
 * `max-w-0` alone collapses the cell to 0px — the note text then renders at
 * zero width and cannot be read or clicked. min-width wins over max-width in
 * CSS, so the column keeps the 12rem the note cell had before, and the table
 * scrolls horizontally past it as it already did.
 */
export const GROW_COL = 'w-full min-w-48 max-w-0 px-3'

/**
 * Columns dropped from the exported image: the tier is already implied by the
 * season, and the date and the note are text nobody reads on a screenshot.
 */
const EXPORT_HIDDEN_COLUMNS = new Set(['tier', 'date', 'note'])

export function buildKnowledgeBaseColumns(
  labels: KnowledgeBaseColumnLabels,
  exporting: boolean
): ReadonlyArray<KnowledgeBaseColumn> {
  const columns: ReadonlyArray<KnowledgeBaseColumn> = [
    // `game_pseudo` is capped at 16 chars in the model, so the column never needs
    // more than that — no reason to let `w-full` hand it any leftover width.
    { id: 'player', col: null, label: labels.player, compact: true },
    { id: 'attacker', col: 'champion_name', label: labels.attacker, compact: true },
    { id: 'defender', col: 'defender_champion_name', label: labels.defender, compact: true },
    { id: 'node', col: 'node_number', label: labels.node, compact: true },
    // At most 2 synergies and 3 prefights per record — both fit in their content width.
    { id: 'synergies', col: null, label: labels.synergies, compact: true },
    { id: 'prefights', col: null, label: labels.prefights, compact: true },
    { id: 'ko', col: 'ko_count', label: labels.ko, compact: true },
    { id: 'alliance', col: 'alliance_name', label: labels.alliance, compact: true },
    { id: 'season', col: 'season_number', label: labels.season, compact: true },
    // Everything below is dropped from the export — kept last so the exported
    // image is just this table cut off on the right, same column order.
    { id: 'tier', col: 'tier', label: labels.tier, compact: true },
    { id: 'date', col: 'created_at', label: labels.date, compact: true },
    { id: 'note', col: null, label: labels.note, grow: true },
  ]
  return exporting ? columns.filter(({ id }) => !EXPORT_HIDDEN_COLUMNS.has(id)) : columns
}
