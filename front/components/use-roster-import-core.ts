import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import {
  RosterEntry,
  bulkUpdateRoster,
  getRoster,
  BulkChampionEntry,
  searchChampions,
} from '@/app/services/roster'
import { type ImportResult } from '@/components/roster/import-report-dialog'
import { type PreviewRow } from '@/components/roster/import-preview-row'

// ─── Shared entry shape consumed by the preview builders ──
// `is_preferred_attacker` is optional on purpose: `undefined` means "this
// source has no opinion on the flag, keep whatever the roster already holds".
// A vision import reads a game screenshot, where the flag simply does not
// exist — sending `false` there would silently un-prefer every champion the
// import touches. A JSON import, which round-trips an export, always carries a
// real boolean and stays authoritative.
export interface RosterImportEntry {
  champion_name: string
  rarity: string
  signature: number
  is_preferred_attacker?: boolean
  ascension: number
}

// ─── Row-building helpers (shared by JSON + vision import) ─

export function deduplicateEntries<T extends RosterImportEntry>(entries: T[]): T[] {
  const deduped = new Map<string, T>()
  for (const entry of entries) {
    const stars = entry.rarity.charAt(0)
    const key = `${entry.champion_name.toLowerCase()}_${stars}`
    deduped.set(key, entry)
  }
  return Array.from(deduped.values())
}

export async function fetchChampionLookup(
  uniqueEntries: RosterImportEntry[],
  roster: RosterEntry[]
): Promise<Map<string, { champion_class: string; image_url: string | null }>> {
  const championLookup = new Map<string, { champion_class: string; image_url: string | null }>()
  const unknownNames = new Set<string>()
  for (const entry of uniqueEntries) {
    const found = roster.find(
      (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase()
    )
    if (!found) unknownNames.add(entry.champion_name)
  }

  if (unknownNames.size > 0) {
    try {
      const res = await searchChampions('', 9999)
      for (const c of res.champions) {
        championLookup.set(c.name.toLowerCase(), {
          champion_class: c.champion_class,
          image_url: c.image_url,
        })
      }
    } catch {
      // search failed — previews will just lack metadata
    }
  }
  return championLookup
}

/**
 * The roster entry an import row lands on, if any.
 *
 * A roster is unique per champion + star level, so a 6★ row and a 7★ row of the
 * same champion are two different entries. The preview diff and the payload
 * built at import time must agree on this rule, hence the single helper.
 */
export function findRosterMatch(
  roster: RosterEntry[],
  championName: string,
  rarity: string
): RosterEntry | undefined {
  const stars = rarity.charAt(0)
  return roster.find(
    (r) =>
      r.champion_name.toLowerCase() === championName.toLowerCase() && r.rarity.startsWith(stars)
  )
}

export function buildPreviewRow(
  entry: RosterImportEntry,
  roster: RosterEntry[],
  championLookup: Map<string, { champion_class: string; image_url: string | null }>
): PreviewRow {
  const existing = findRosterMatch(roster, entry.champion_name, entry.rarity)

  const isNew = !existing
  const hasChanges =
    existing != null &&
    (existing.rarity !== entry.rarity ||
      existing.signature !== entry.signature ||
      (entry.is_preferred_attacker != null &&
        existing.is_preferred_attacker !== entry.is_preferred_attacker) ||
      (existing.ascension ?? 0) !== entry.ascension)

  const rosterMatch = roster.find(
    (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase()
  )
  const apiMatch = championLookup.get(entry.champion_name.toLowerCase())

  return {
    champion_name: entry.champion_name,
    champion_class: rosterMatch?.champion_class ?? apiMatch?.champion_class ?? null,
    image_url: rosterMatch?.image_url ?? apiMatch?.image_url ?? null,
    newRarity: entry.rarity,
    newSignature: entry.signature,
    oldRarity: existing?.rarity ?? null,
    oldSignature: existing?.signature ?? null,
    oldAscension: existing?.ascension ?? null,
    isNew,
    hasChanges,
    is_preferred_attacker: entry.is_preferred_attacker,
    ascension: entry.ascension,
  }
}

/**
 * Re-run the roster diff for a row whose champion changed.
 *
 * Correcting the name changes which roster entry the row corresponds to, so
 * oldRarity / oldSignature / oldAscension / isNew / hasChanges all have to be
 * recomputed — they were derived against the *previous* name. Skipping this
 * makes the row claim "new" for a champion already owned, and the import then
 * writes the wrong rarity to the roster.
 */
export function rediffRow(
  row: PreviewRow,
  roster: RosterEntry[],
  championLookup: Map<string, { champion_class: string; image_url: string | null }>
): PreviewRow {
  const rebuilt = buildPreviewRow(
    {
      champion_name: row.champion_name,
      rarity: row.newRarity,
      signature: row.newSignature,
      ascension: row.ascension ?? 0,
      is_preferred_attacker: row.is_preferred_attacker,
    } as RosterImportEntry,
    roster,
    championLookup
  )
  // Keep the vision-only fields: they describe the model's reading, which the
  // roster diff knows nothing about.
  return {
    ...rebuilt,
    confidence: row.confidence,
    cropUrl: row.cropUrl,
    prediction_id: row.prediction_id,
    editable: row.editable,
    candidates: row.candidates,
    margin: row.margin,
    corrected: row.corrected,
  }
}

// ─── Hook ─────────────────────────────────────────────────

export interface UseRosterImportCoreProps {
  roster: RosterEntry[]
  selectedAccountId: string
  onRosterUpdated: (roster: RosterEntry[]) => void
}

export function useRosterImportCore({
  roster,
  selectedAccountId,
  onRosterUpdated,
}: UseRosterImportCoreProps) {
  const { t } = useI18n()

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])

  const openPreview = useCallback((rows: PreviewRow[]) => {
    setPreviewRows(rows)
    setPreviewOpen(true)
  }, [])

  // ── Execute import via bulk API ────────────────────────
  // Returns whether the roster write actually succeeded — additive to the
  // previous void return, so callers that ignore it (JSON import) are
  // unaffected. Callers that archive data derived from this import (vision)
  // must check `success` before doing so.
  const executeImport = useCallback(async (): Promise<{ success: boolean }> => {
    if (previewRows.length === 0) return { success: true }
    setImporting(true)

    const results: ImportResult[] = []
    let success = true

    try {
      // Only send entries that are new or have changes
      const toSend = previewRows.filter((r) => r.isNew || r.hasChanges)

      if (toSend.length === 0) {
        toast.info(t.roster.importExport.noChanges)
        setPreviewOpen(false)
        setImporting(false)
        return { success: true }
      }

      // The bulk endpoint overwrites `is_preferred_attacker` with whatever it
      // receives, so a row with no opinion (vision) has to re-send the value
      // the roster already holds. Falling back to `false` here is what used to
      // strip the flag off every champion a vision import updated.
      const champions: BulkChampionEntry[] = toSend.map((r) => ({
        champion_name: r.champion_name,
        rarity: r.newRarity,
        signature: r.newSignature,
        is_preferred_attacker:
          r.is_preferred_attacker ??
          findRosterMatch(roster, r.champion_name, r.newRarity)?.is_preferred_attacker ??
          false,
        ascension: r.ascension ?? 0,
      }))

      try {
        await bulkUpdateRoster(selectedAccountId, champions)

        // All succeeded (bulk is atomic) — build rich results
        for (const row of toSend) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: row.isNew,
            isSkipped: false,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
          })
        }

        // Mark unchanged entries as skipped
        for (const row of previewRows.filter((r) => !r.isNew && !r.hasChanges)) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: false,
            isSkipped: true,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
          })
        }
      } catch (err) {
        // Bulk failed entirely
        success = false
        for (const row of previewRows) {
          results.push({
            champion_name: row.champion_name,
            success: false,
            isNew: row.isNew,
            isSkipped: false,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
            error:
              (err instanceof Error ? err.message : undefined) || t.roster.importExport.serverError,
          })
        }
      }

      // Refresh roster
      try {
        const updated = await getRoster(selectedAccountId)
        onRosterUpdated(updated)
      } catch {
        // roster refresh failed, not critical
      }
    } finally {
      setImporting(false)
      setPreviewOpen(false)
      setImportResults(results)
      setReportOpen(true)
    }

    return { success }
  }, [previewRows, roster, selectedAccountId, onRosterUpdated, t])

  return {
    previewOpen,
    setPreviewOpen,
    previewRows,
    setPreviewRows,
    importing,
    reportOpen,
    setReportOpen,
    importResults,
    openPreview,
    executeImport,
  }
}
