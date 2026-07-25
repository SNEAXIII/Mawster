import { useEffect, useState } from 'react'
import { RosterEntry } from '@/app/services/roster'
import { useI18n } from '@/app/i18n'
import { useRosterImportVision } from './use-roster-import-vision'
import { useVisionImportGuard } from './use-vision-import-guard'
import { useVisionImportHowto } from './use-vision-import-howto'

export interface UseVisionImportSectionProps {
  roster: RosterEntry[]
  selectedAccountId: string
  onRosterUpdated: (roster: RosterEntry[]) => void
}

// Everything the AI import needs, kept out of RosterImportExport: that file
// was already over the size budget before the how-to dialog was added.
export function useVisionImportSection({
  roster,
  selectedAccountId,
  onRosterUpdated,
}: UseVisionImportSectionProps) {
  const { t } = useI18n()
  const [shareDataset, setShareDataset] = useState(false)
  const [bannerRefreshKey, setBannerRefreshKey] = useState(0)

  const vision = useRosterImportVision({ roster, selectedAccountId, shareDataset, onRosterUpdated })
  const howto = useVisionImportHowto()

  // Order matters: the 409 guard runs first, so a user who is about to be
  // blocked never reads a procedure they cannot follow.
  const guard = useVisionImportGuard({
    selectedAccountId,
    resume: vision.resume,
    onOpenFilePicker: () => howto.request(() => vision.visionInputRef.current?.click()),
    // Skips the how-to on purpose: see the comment on onDiscardFilePicker in
    // use-vision-import-guard.ts.
    onDiscardFilePicker: () => vision.visionInputRef.current?.click(),
  })

  // When an upload creates an import, tell the banner to re-fetch: it only
  // reloads on mount and on this signal, so without the bump it would stay
  // blank through processing and only appear once the popup is closed. This
  // makes the "reading in progress" banner show as soon as the job is queued.
  useEffect(() => {
    if (vision.importId != null) {
      setBannerRefreshKey((key) => key + 1)
    }
  }, [vision.importId])

  const executeVisionImport = async () => {
    const { success } = await vision.executeImport()
    // Only archive the dataset when the roster write actually succeeded —
    // otherwise we'd claim corrections as training data that never made it
    // into any roster.
    if (success) {
      await vision.onConfirmed()
    }
    // The import is now confirmed (or still sitting at "done" if the roster
    // write failed) — either way the banner's cached status is stale.
    setBannerRefreshKey((key) => key + 1)
  }

  const visionLabel = !vision.uploading
    ? t.roster.importExport.importVision
    : vision.importId == null
      ? t.roster.importExport.visionUploading
      : t.roster.importExport.visionProcessing

  return {
    vision,
    guard,
    howto,
    shareDataset,
    setShareDataset,
    bannerRefreshKey,
    executeVisionImport,
    visionLabel,
    onVisionClick: () => void guard.guardedOpen(),
  }
}
