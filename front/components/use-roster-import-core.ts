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
export interface RosterImportEntry {
  champion_name: string
  rarity: string
  signature: number
  is_preferred_attacker: boolean
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

export function buildPreviewRow(
  entry: RosterImportEntry,
  roster: RosterEntry[],
  championLookup: Map<string, { champion_class: string; image_url: string | null }>
): PreviewRow {
  const stars = entry.rarity.charAt(0)
  const existing = roster.find(
    (r) =>
      r.champion_name.toLowerCase() === entry.champion_name.toLowerCase() &&
      r.rarity.startsWith(stars)
  )

  const isNew = !existing
  const hasChanges =
    existing != null &&
    (existing.rarity !== entry.rarity ||
      existing.signature !== entry.signature ||
      existing.is_preferred_attacker !== entry.is_preferred_attacker ||
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
    isNew,
    hasChanges,
    is_preferred_attacker: entry.is_preferred_attacker,
    ascension: entry.ascension,
  }
}

// ─── Hook ─────────────────────────────────────────────────

export interface UseRosterImportCoreProps {
  roster: RosterEntry[]
  selectedAccountId: string
  onRosterUpdated: (roster: RosterEntry[]) => void
}

export function useRosterImportCore({
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
  const executeImport = useCallback(async () => {
    if (previewRows.length === 0) return
    setImporting(true)

    const results: ImportResult[] = []

    try {
      // Only send entries that are new or have changes
      const toSend = previewRows.filter((r) => r.isNew || r.hasChanges)

      if (toSend.length === 0) {
        toast.info(t.roster.importExport.noChanges)
        setPreviewOpen(false)
        setImporting(false)
        return
      }

      const champions: BulkChampionEntry[] = toSend.map((r) => ({
        champion_name: r.champion_name,
        rarity: r.newRarity,
        signature: r.newSignature,
        is_preferred_attacker: r.is_preferred_attacker ?? false,
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
  }, [previewRows, selectedAccountId, onRosterUpdated, t])

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
