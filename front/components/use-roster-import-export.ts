import { type ChangeEvent, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { RosterEntry, raritySortValue } from '@/app/services/roster'
import { type PreviewRow } from '@/components/roster/import-preview-row'
import {
  useRosterImportCore,
  buildPreviewRow,
  deduplicateEntries,
  fetchChampionLookup,
  type RosterImportEntry,
} from '@/components/use-roster-import-core'

// ─── Export format (simplified) ──────────────────────────
export type RosterExportEntry = RosterImportEntry

// ─── Validation helpers ──────────────────────────────────

function validateEntry(
  obj: Record<string, unknown>,
  idx: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): { entry?: RosterExportEntry; error?: string } {
  if (!obj.champion_name || typeof obj.champion_name !== 'string') {
    return { error: t.roster.importExport.missingChampionName.replace('{idx}', String(idx)) }
  }
  if (!obj.rarity || typeof obj.rarity !== 'string') {
    return { error: t.roster.importExport.missingRarity.replace('{idx}', String(idx)) }
  }
  if (!/^[67]r[1-5]$/.exec(obj.rarity)) {
    return {
      error: t.roster.importExport.invalidRarity
        .replace('{idx}', String(idx))
        .replace('{name}', obj.champion_name)
        .replace('{rarity}', obj.rarity),
    }
  }
  if (obj.signature !== undefined && (typeof obj.signature !== 'number' || obj.signature < 0)) {
    return {
      error: t.roster.importExport.invalidSignature
        .replace('{idx}', String(idx))
        .replace('{name}', obj.champion_name),
    }
  }

  return {
    entry: {
      champion_name: obj.champion_name,
      rarity: obj.rarity,
      signature: typeof obj.signature === 'number' ? obj.signature : 0,
      is_preferred_attacker: obj.is_preferred_attacker === true,
      ascension:
        typeof obj.ascension === 'number' && obj.ascension >= 0 && obj.ascension <= 2
          ? obj.ascension
          : 0,
    },
  }
}

function parseAndValidateEntries(
  parsed: unknown[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): { entries: RosterExportEntry[]; errors: string[] } {
  const entries: RosterExportEntry[] = []
  const errors: string[] = []

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    const idx = i + 1

    if (!item || typeof item !== 'object') {
      errors.push(t.roster.importExport.entryNotObject.replace('{idx}', String(idx)))
      continue
    }

    const result = validateEntry(item as Record<string, unknown>, idx, t)
    if (result.error) {
      errors.push(result.error)
    } else if (result.entry) {
      entries.push(result.entry)
    }
  }

  return { entries, errors }
}

function parseJsonFile(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): unknown[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new TypeError(t.roster.importExport.invalidJson)
  }

  if (!Array.isArray(parsed)) {
    throw new TypeError(t.roster.importExport.notArray)
  }

  if (parsed.length === 0) {
    throw new TypeError(t.roster.importExport.emptyFile)
  }

  return parsed
}

// ─── Hook ─────────────────────────────────────────────────

export interface UseRosterImportExportProps {
  roster: RosterEntry[]
  selectedAccountId: string
  selectedAccountName: string
  onRosterUpdated: (roster: RosterEntry[]) => void
}

export function useRosterImportExport({
  roster,
  selectedAccountId,
  selectedAccountName,
  onRosterUpdated,
}: UseRosterImportExportProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const core = useRosterImportCore({ roster, selectedAccountId, onRosterUpdated })

  // ── Export ─────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (roster.length === 0) {
      toast.warning(t.roster.importExport.emptyExport)
      return
    }

    const data: RosterExportEntry[] = roster.map((e) => ({
      champion_name: e.champion_name,
      rarity: e.rarity,
      signature: e.signature,
      is_preferred_attacker: e.is_preferred_attacker,
      ascension: e.ascension ?? 0,
    }))

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = selectedAccountName.replaceAll(/[^a-zA-Z0-9_-]/g, '_')
    a.download = `roster_${safeName}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    toast.success(t.roster.importExport.exportedCount.replace('{count}', String(data.length)))
  }, [roster, selectedAccountName, t])

  // ── Import: parse + validate + build preview ───────────
  const handleFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset file input so same file can be re-selected
      e.target.value = ''

      try {
        const text = await file.text()
        const parsed = parseJsonFile(text, t)
        const { entries, errors } = parseAndValidateEntries(parsed, t)

        if (errors.length > 0 && entries.length === 0) {
          throw new TypeError(`${t.roster.importExport.allInvalid}\n${errors.join('\n')}`)
        }

        if (errors.length > 0) {
          toast.warning(
            t.roster.importExport.skippedEntries.replace('{count}', String(errors.length))
          )
        }

        const uniqueEntries = deduplicateEntries(entries)
        const championLookup = await fetchChampionLookup(uniqueEntries, roster)

        const rows: PreviewRow[] = uniqueEntries.map((entry) =>
          buildPreviewRow(entry, roster, championLookup)
        )

        // Sort: new first, then changes, then unchanged
        rows.sort((a, b) => {
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
          if (a.hasChanges !== b.hasChanges) return a.hasChanges ? -1 : 1
          return raritySortValue(b.newRarity) - raritySortValue(a.newRarity)
        })

        core.openPreview(rows)
      } catch (err: unknown) {
        toast.error((err as Error).message || t.roster.importExport.fileReadError)
      }
    },
    [roster, t, core.openPreview]
  )

  return {
    fileInputRef,
    previewOpen: core.previewOpen,
    setPreviewOpen: core.setPreviewOpen,
    previewRows: core.previewRows,
    importing: core.importing,
    reportOpen: core.reportOpen,
    setReportOpen: core.setReportOpen,
    importResults: core.importResults,
    handleExport,
    handleFileSelected,
    executeImport: core.executeImport,
  }
}
