'use client';

import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RosterEntry } from '@/app/services/roster';
import ImportPreviewDialog from '@/components/roster/import-preview-dialog';
import ImportReportDialog from '@/components/roster/import-report-dialog';
import { useRosterImportExport } from './use-roster-import-export';
import { useI18n } from '@/app/i18n';

export type { RosterExportEntry } from './use-roster-import-export';

// ─── Props ───────────────────────────────────────────────
interface RosterImportExportProps {
  roster: RosterEntry[];
  selectedAccountId: string;
  selectedAccountName: string;
  onRosterUpdated: (roster: RosterEntry[]) => void;
}

export default function RosterImportExport({
  roster,
  selectedAccountId,
  selectedAccountName,
  onRosterUpdated,
}: Readonly<RosterImportExportProps>) {
  const { t } = useI18n();
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
  } = useRosterImportExport({ roster, selectedAccountId, selectedAccountName, onRosterUpdated });

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.json,application/json'
        className='hidden'
        onChange={handleFileSelected}
      />

      {/* Export / Import buttons */}
      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
        >
          <Download className='mr-1.5 h-3.5 w-3.5' />
          {t.roster.importExport.exportJson}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => fileInputRef.current?.click()}
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

      <ImportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        results={importResults}
      />
    </>
  );
}
