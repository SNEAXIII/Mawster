'use client'

import { useEffect, useState } from 'react'
import { RosterEntry } from '@/app/services/roster'
import ImportPreviewDialog from '@/components/roster/import-preview-dialog'
import ImportReportDialog from '@/components/roster/import-report-dialog'
import RosterImportButtons from '@/components/roster/roster-import-buttons'
import VisionImportBlockedDialog from '@/components/roster/vision-import-blocked-dialog'
import VisionImportBanner from '@/app/game/account/_components/vision-import-banner'
import VisionBetaNotice from '@/components/roster/vision-beta-notice'
import { useRosterImportExport } from './use-roster-import-export'
import { useRosterImportVision } from './use-roster-import-vision'
import { useVisionImportGuard } from './use-vision-import-guard'
import { useI18n } from '@/app/i18n'

export type { RosterExportEntry } from './use-roster-import-export'

// ─── Props ───────────────────────────────────────────────
interface RosterImportExportProps {
  roster: RosterEntry[]
  selectedAccountId: string
  selectedAccountName: string
  onRosterUpdated: (roster: RosterEntry[]) => void
}

export default function RosterImportExport({
  roster,
  selectedAccountId,
  selectedAccountName,
  onRosterUpdated,
}: Readonly<RosterImportExportProps>) {
  const { t } = useI18n()
  const [shareDataset, setShareDataset] = useState(false)
  const [bannerRefreshKey, setBannerRefreshKey] = useState(0)

  const {
    fileInputRef,
    previewOpen,
    setPreviewOpen,
    previewRows,
    importing,
    reportOpen,
    setReportOpen,
    importResults,
    handleExport,
    handleFileSelected,
    executeImport,
  } = useRosterImportExport({ roster, selectedAccountId, selectedAccountName, onRosterUpdated })

  const vision = useRosterImportVision({ roster, selectedAccountId, shareDataset, onRosterUpdated })

  const guard = useVisionImportGuard({
    selectedAccountId,
    resume: vision.resume,
    onOpenFilePicker: () => vision.visionInputRef.current?.click(),
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

  return (
    <>
      <VisionImportBanner
        gameAccountId={selectedAccountId}
        onResume={vision.resume}
        refreshSignal={bannerRefreshKey}
      />
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.json,application/json'
        className='hidden'
        onChange={handleFileSelected}
        data-cy='json-import-input'
      />
      <input
        ref={vision.visionInputRef}
        type='file'
        accept='image/*'
        multiple
        className='hidden'
        onChange={vision.handleVisionFilesSelected}
        data-cy='vision-input'
      />

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <RosterImportButtons
          visionLabel={visionLabel}
          visionUploading={vision.uploading}
          onVisionClick={() => void guard.guardedOpen()}
          onExport={handleExport}
          onImportJson={() => fileInputRef.current?.click()}
        />
        <VisionBetaNotice />
      </div>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewRows={previewRows}
        importing={importing}
        onImport={executeImport}
      />

      <ImportPreviewDialog
        open={vision.previewOpen}
        onOpenChange={vision.setPreviewOpen}
        previewRows={vision.previewRows}
        importing={vision.importing}
        onImport={executeVisionImport}
        editable
        onRowChange={vision.onRowChange}
        shareDataset={shareDataset}
        onShareDatasetChange={setShareDataset}
      />

      <ImportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        results={importResults}
      />

      <ImportReportDialog
        open={vision.reportOpen}
        onOpenChange={vision.setReportOpen}
        results={vision.importResults}
      />

      <VisionImportBlockedDialog
        open={guard.dialogOpen}
        onOpenChange={guard.setDialogOpen}
        onResume={guard.resumeBlocked}
        onDiscard={guard.discardBlocked}
      />
    </>
  )
}
