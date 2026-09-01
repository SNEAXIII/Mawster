'use client'
import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import { exportFilename, useImageExport } from '@/hooks/use-image-export'
import { Button } from '@/components/ui/button'
import { useKnowledgeBaseViewModel } from '../_viewmodels/use-knowledge-base-viewmodel'
import KnowledgeBaseFilters from './knowledge-base-filters'
import KnowledgeBaseTable from './knowledge-base-table'
import PaginationControls from '@/components/dashboard/pagination/pagination-controls'

export default function HistoryTab() {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const vm = useKnowledgeBaseViewModel()
  const exportRef = useRef<HTMLDivElement>(null)
  const { exporting, exportPng } = useImageExport()

  // Only the current page is captured — the table renders what the filters and
  // the pagination already selected, nothing more.
  const handleExport = () => exportPng(exportRef, exportFilename('knowledge-base'))

  return (
    <div className='flex flex-col gap-4'>
      {vm.data && (
        <PaginationControls
          currentPage={vm.page}
          totalPage={vm.data.pages}
          usersPerPage={vm.size}
          canReset={vm.page !== 1 || vm.hasActiveFilters}
          canImport={vm.canImport}
          onUserPerPageChange={(v) => {
            vm.setSize(Number(v))
            vm.setPage(1)
          }}
          onFirstPage={() => vm.setPage(1)}
          onPreviousPage={() => vm.setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => vm.setPage((p) => Math.min(vm.data!.pages, p + 1))}
          onLastPage={() => vm.setPage(vm.data!.pages)}
          onResetPagination={() => {
            vm.setPage(1)
            vm.handleClearFilters()
          }}
        />
      )}
      <div className='flex flex-wrap items-center gap-2'>
        <KnowledgeBaseFilters
          filters={vm.filters}
          planningErrorOnly={vm.planningErrorOnly}
          seasonSelector={vm.seasonSelector}
          seasonId={vm.seasonId}
          seasons={vm.seasons}
          allianceId={vm.allianceId}
          accessibleAlliances={vm.accessibleAlliances}
          onChange={vm.handleFilterChange}
          onTogglePlanningError={vm.handleTogglePlanningError}
          onSeasonSelectorChange={vm.handleSeasonSelectorChange}
          onSeasonIdChange={vm.handleSeasonIdChange}
          onAllianceChange={vm.handleAllianceChange}
          source={vm.source}
          onSourceChange={vm.handleSourceChange}
          onClear={vm.handleClearFilters}
        />
        <Button
          variant='outline'
          size='sm'
          className='ml-auto'
          data-cy='kb-export-image-btn'
          onClick={handleExport}
          disabled={exporting || !vm.data || vm.data.items.length === 0}
          title={kb.exportImage}
        >
          <Camera className='w-4 h-4 mr-1' />
          {exporting ? '…' : kb.exportImage}
        </Button>
      </div>

      {vm.data && (
        <ExportModeProvider value={exporting}>
          <KnowledgeBaseTable
            records={vm.data.items}
            loading={vm.loading}
            sortBy={vm.sortBy}
            sortOrder={vm.sortOrder}
            onSort={vm.handleSort}
            exporting={exporting}
            exportRef={exportRef}
          />
        </ExportModeProvider>
      )}
      {vm.error && <p className='text-destructive text-sm'>{vm.error}</p>}
    </div>
  )
}
