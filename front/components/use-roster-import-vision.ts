import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { RosterEntry } from '@/app/services/roster'
import {
  createVisionImport,
  getVisionImport,
  getVisionPredictions,
  getCropUrl,
  confirmVisionImport,
  type VisionPrediction,
  type ConfirmedRow,
} from '@/app/services/vision'
import { type PreviewRow, type PreviewRowPatch } from '@/components/roster/import-preview-row'
import {
  useRosterImportCore,
  buildPreviewRow,
  fetchChampionLookup,
  rediffRow,
  type RosterImportEntry,
} from '@/components/use-roster-import-core'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ITERATIONS = 120

// A prediction is only trustworthy enough to auto-apply its rarity when
// stars/rank fall inside the game's valid range. Out-of-range predictions
// are still surfaced (never silently dropped) but flagged as doubtful.
function predictionToEntry(prediction: VisionPrediction): {
  entry: RosterImportEntry
  rarityValid: boolean
} {
  const rarity = `${prediction.stars}r${prediction.rank}`
  return {
    entry: {
      champion_name: prediction.champion_name ?? '',
      rarity,
      signature: prediction.signature,
      ascension: prediction.ascension,
      is_preferred_attacker: false,
    },
    rarityValid: /^[67]r[1-5]$/.test(rarity),
  }
}

export interface UseRosterImportVisionProps {
  roster: RosterEntry[]
  selectedAccountId: string
  shareDataset: boolean
  onRosterUpdated: (roster: RosterEntry[]) => void
}

export function useRosterImportVision({
  roster,
  selectedAccountId,
  shareDataset,
  onRosterUpdated,
}: UseRosterImportVisionProps) {
  const { t } = useI18n()
  const core = useRosterImportCore({ roster, selectedAccountId, onRosterUpdated })

  const visionInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [importId, setImportId] = useState<string | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const pollBusyRef = useRef(false)

  // Kept around so a later manual correction can re-diff without a second
  // catalogue fetch — the diff cannot be recomputed without it, and reaching
  // for a second copy would be the bug this ref exists to prevent.
  const championLookupRef = useRef<
    Map<string, { champion_class: string; image_url: string | null }>
  >(new Map())

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // Stop the poll on unmount so a dead worker can't keep firing requests.
  useEffect(() => clearPoll, [clearPoll])

  const finishWithError = useCallback(
    (message: string) => {
      clearPoll()
      setUploading(false)
      toast.error(message)
    },
    [clearPoll]
  )

  // ── Predictions → PreviewRow[] ──────────────────────────
  const buildRowsFromPredictions = useCallback(
    async (currentImportId: string, predictions: VisionPrediction[]): Promise<PreviewRow[]> => {
      const built = predictions.map(predictionToEntry)
      const lookup = await fetchChampionLookup(
        built.map((b) => b.entry),
        roster
      )
      championLookupRef.current = lookup

      return predictions.map((prediction, idx) => {
        const { entry, rarityValid } = built[idx]
        const row = buildPreviewRow(entry, roster, lookup)

        // getCropUrl is a plain URL builder (no request) — the browser fetches
        // it lazily via the <img> tag, through the same-origin proxy.
        const cropUrl =
          prediction.crop_index != null
            ? getCropUrl(currentImportId, prediction.job_id, prediction.crop_index)
            : null

        return {
          ...row,
          // Force low confidence on out-of-range rarities so the review
          // screen flags the row instead of silently trusting a bad guess.
          confidence: rarityValid ? prediction.confidence : 0,
          candidates: prediction.candidates ?? [],
          // The badge reads the margin, not the score, so the out-of-range
          // safeguard above has to be mirrored here or it stops working: a bad
          // rarity with a confident name would otherwise badge green.
          margin: rarityValid ? prediction.margin : null,
          cropUrl,
          prediction_id: prediction.id,
          // Vision predictions always go through the editable review row —
          // unlike JSON rows, which are trusted as-is.
          editable: true,
        }
      })
    },
    [roster]
  )

  // ── Resume the review from an import id ─────────────────
  // Shared tail of the upload flow: also the entry point a banner can call
  // directly once it already knows the importId, without re-running upload/poll.
  const resume = useCallback(
    async (currentImportId: string) => {
      setImportId(currentImportId)
      const predictionsRes = await getVisionPredictions(currentImportId)
      const rows = await buildRowsFromPredictions(currentImportId, predictionsRes.predictions)
      setUploading(false)
      if (rows.length === 0) {
        toast.error(t.roster.importExport.visionNoChampions)
        return
      }
      core.openPreview(rows)
    },
    [buildRowsFromPredictions, core.openPreview, t]
  )

  // ── Polling ──────────────────────────────────────────────
  const pollImport = useCallback(
    (currentImportId: string) => {
      clearPoll()
      pollCountRef.current = 0
      pollBusyRef.current = false

      pollTimerRef.current = setInterval(() => {
        if (pollBusyRef.current) return
        pollBusyRef.current = true
        pollCountRef.current += 1

        void (async () => {
          try {
            const status = await getVisionImport(currentImportId)

            if (status.status === 'done') {
              clearPoll()
              await resume(currentImportId)
              return
            }

            if (status.status === 'failed') {
              finishWithError(t.roster.importExport.vision.pollFailed)
              return
            }

            if (pollCountRef.current >= POLL_MAX_ITERATIONS) {
              finishWithError(t.roster.importExport.vision.pollTimeout)
            }
          } catch {
            finishWithError(t.roster.importExport.vision.pollFailed)
          } finally {
            pollBusyRef.current = false
          }
        })()
      }, POLL_INTERVAL_MS)
    },
    [clearPoll, resume, finishWithError, t]
  )

  // ── Upload ───────────────────────────────────────────────
  const handleVisionFilesSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files
      const files = fileList ? Array.from(fileList).filter((f) => f.type.startsWith('image/')) : []
      e.target.value = ''

      if (files.length === 0) {
        toast.error(t.roster.importExport.vision.noImagesSelected)
        return
      }

      setUploading(true)
      try {
        const created = await createVisionImport(selectedAccountId, files, shareDataset)
        setImportId(created.id)
        pollImport(created.id)
      } catch {
        finishWithError(t.roster.importExport.vision.uploadError)
      }
    },
    [selectedAccountId, shareDataset, pollImport, finishWithError, t]
  )

  // ── Manual corrections from the editable review row ─────
  const onRowChange = useCallback(
    (index: number, patch: PreviewRowPatch) => {
      core.setPreviewRows((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row
          const updated = { ...row, ...patch }
          const renamed = patch.champion_name != null && patch.champion_name !== row.champion_name
          const base = renamed
            ? {
                ...rediffRow(updated, roster, championLookupRef.current),
                corrected: true,
              }
            : updated
          return {
            ...base,
            // Recompute the diff so a manually corrected row still counts
            // toward the import (isNew rows always do). Ascension is included
            // alongside rarity/signature — otherwise an ascension-only fix
            // flips hasChanges to false and the row silently gets dropped
            // from the import.
            hasChanges:
              base.isNew ||
              base.oldRarity !== base.newRarity ||
              base.oldSignature !== base.newSignature ||
              (base.oldAscension ?? 0) !== (base.ascension ?? 0),
          }
        })
      )
    },
    [core.setPreviewRows, roster]
  )

  // ── Archive the confirmed dataset (best-effort) ─────────
  const onConfirmed = useCallback(async () => {
    if (importId == null) return
    const rows: ConfirmedRow[] = core.previewRows.map((row) => ({
      champion_name: row.champion_name,
      rarity: row.newRarity,
      signature: row.newSignature,
      ascension: row.ascension ?? 0,
      is_preferred_attacker: row.is_preferred_attacker ?? false,
      prediction_id: row.prediction_id ?? null,
    }))

    try {
      await confirmVisionImport(importId, rows)
    } catch {
      // Archiving the dataset is best-effort — the roster write already succeeded,
      // so this must not fail the import. Still, silently swallowing it left the
      // user with no signal their "contribute to the dataset" opt-in did nothing.
      toast.warning(t.roster.importExport.vision.datasetArchiveFailed)
    }
  }, [importId, core.previewRows, t])

  return {
    visionInputRef,
    handleVisionFilesSelected,
    uploading,
    importId,
    resume,
    previewOpen: core.previewOpen,
    setPreviewOpen: core.setPreviewOpen,
    previewRows: core.previewRows,
    importing: core.importing,
    reportOpen: core.reportOpen,
    setReportOpen: core.setReportOpen,
    importResults: core.importResults,
    executeImport: core.executeImport,
    onRowChange,
    onConfirmed,
  }
}
