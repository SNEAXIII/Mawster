import { RARITIES } from '@/app/services/roster'
import { type PreviewRow } from './import-preview-row'

// The bulk endpoint is atomic: one row the API rejects fails the whole batch,
// so a single misread rank used to turn a 22-champion import into 22 errors.
// Every row is therefore checked against the same rules the API enforces
// *before* anything is sent.
export type RowIssue = 'missingName' | 'invalidRarity'

/**
 * The API's rarity set, not a regex approximating it.
 *
 * A hand-written `/^[67]r[1-5]$/` drifted from the enum in both directions: it
 * accepted 6r1..6r3, which the API rejects, and rejected 7r6, which it accepts.
 */
export function isValidRarity(rarity: string): boolean {
  return (RARITIES as string[]).includes(rarity)
}

export function rowIssues(row: PreviewRow): RowIssue[] {
  const issues: RowIssue[] = []
  if (row.champion_name.trim() === '') issues.push('missingName')
  if (!isValidRarity(row.newRarity)) issues.push('invalidRarity')
  return issues
}

/** Rows that would be sent and that the API would reject. */
export function blockingRows(rows: PreviewRow[]): PreviewRow[] {
  return rows.filter((r) => !r.ignored && (r.isNew || r.hasChanges) && rowIssues(r).length > 0)
}
