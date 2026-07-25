'use client'

import VisionImportBanner from '@/app/game/account/_components/vision-import-banner'
import ImportPreviewDialog from '@/components/roster/import-preview-dialog'
import ImportReportDialog from '@/components/roster/import-report-dialog'
import VisionImportBlockedDialog from '@/components/roster/vision-import-blocked-dialog'
import VisionImportHowtoDialog from '@/components/roster/vision-import-howto-dialog'
import type { useVisionImportSection } from '@/components/use-vision-import-section'

interface VisionImportSectionProps {
  gameAccountId: string
  state: ReturnType<typeof useVisionImportSection>
}

// Renders every AI-import surface: the pending-import banner, the hidden
// screenshot input, and the preview / report / blocked / how-to dialogs. The
// buttons stay in the parent so the button row keeps its layout.
export default function VisionImportSection({
  gameAccountId,
  state,
}: Readonly<VisionImportSectionProps>) {
  const { vision, guard, howto } = state

  return (
    <>
      <VisionImportBanner
        gameAccountId={gameAccountId}
        onResume={vision.resume}
        refreshSignal={state.bannerRefreshKey}
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

      <ImportPreviewDialog
        open={vision.previewOpen}
        onOpenChange={vision.setPreviewOpen}
        previewRows={vision.previewRows}
        importing={vision.importing}
        onImport={state.executeVisionImport}
        editable
        onRowChange={vision.onRowChange}
        shareDataset={state.shareDataset}
        onShareDatasetChange={state.setShareDataset}
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

      <VisionImportHowtoDialog
        open={howto.open}
        onOpenChange={howto.setOpen}
        onConfirm={howto.confirm}
        dontShow={howto.dontShow}
        onDontShowChange={howto.setDontShow}
      />
    </>
  )
}
