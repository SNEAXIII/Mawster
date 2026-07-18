'use client'

import { useState } from 'react'
import { Download, ScanLine, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RosterEntry } from '@/app/services/roster'
import ImportPreviewDialog from '@/components/roster/import-preview-dialog'
import ImportReportDialog from '@/components/roster/import-report-dialog'
import { useRosterImportExport } from './use-roster-import-export'
import { useRosterImportVision } from './use-roster-import-vision'
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

  const executeVisionImport = async () => {
    const { success } = await vision.executeImport()
    // Only archive the dataset when the roster write actually succeeded —
    // otherwise we'd claim corrections as training data that never made it
    // into any roster.
    if (success) {
      await vision.onConfirmed()
    }
  }

  const visionLabel = !vision.uploading
    ? t.roster.importExport.importVision
    : vision.importId == null
      ? t.roster.importExport.visionUploading
      : t.roster.importExport.visionProcessing

  return (
    <>
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

      {/* Export / Import buttons */}
      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => vision.visionInputRef.current?.click()}
          disabled={vision.uploading}
          data-cy='import-vision-button'
        >
          <ScanLine className='mr-1.5 h-3.5 w-3.5' />
          {visionLabel}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
          data-cy='export-json-button'
        >
          <Download className='mr-1.5 h-3.5 w-3.5' />
          {t.roster.importExport.exportJson}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => fileInputRef.current?.click()}
          data-cy='import-json-button'
        >
          <Upload className='mr-1.5 h-3.5 w-3.5' />
          {t.roster.importExport.importJson}
        </Button>
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
    </>
  )
}
