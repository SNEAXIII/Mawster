'use client'

import { RosterEntry } from '@/app/services/roster'
import ImportPreviewDialog from '@/components/roster/import-preview-dialog'
import ImportReportDialog from '@/components/roster/import-report-dialog'
import RosterImportButtons from '@/components/roster/roster-import-buttons'
import VisionImportSection from '@/components/roster/vision-import-section'
import VisionBetaNotice from '@/components/roster/vision-beta-notice'
import { useRosterImportExport } from './use-roster-import-export'
import { useVisionImportSection } from './use-vision-import-section'

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

  const visionSection = useVisionImportSection({ roster, selectedAccountId, onRosterUpdated })

  return (
    <>
      <VisionImportSection
        gameAccountId={selectedAccountId}
        state={visionSection}
      />

      <input
        ref={fileInputRef}
        type='file'
        accept='.json,application/json'
        className='hidden'
        onChange={handleFileSelected}
        data-cy='json-import-input'
      />

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <RosterImportButtons
          visionLabel={visionSection.visionLabel}
          visionUploading={visionSection.vision.uploading}
          onVisionClick={visionSection.onVisionClick}
          onVisionHelpClick={visionSection.howto.reopen}
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

      <ImportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        results={importResults}
      />
    </>
  )
}
