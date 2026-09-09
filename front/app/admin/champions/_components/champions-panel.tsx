'use client'

import { useState } from 'react'
import PaginationControls from '@/components/dashboard/pagination/pagination-controls'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { ErrorBanner } from '@/components/error-banner'
import { useI18n } from '@/app/i18n'
import type { Champion } from '@/app/services/champions'
import { useChampionsViewModel } from '@/app/admin/_viewmodels/use-champions-viewmodel'
import ChampionsFilterBar from './champions-filter-bar'
import ChampionsActiveFilters from './champions-active-filters'
import ChampionsIoButtons from './champions-io-buttons'
import ChampionsTable from './champions-table'

export default function ChampionsPanel() {
  const { t } = useI18n()
  const vm = useChampionsViewModel()
  const [deleteTarget, setDeleteTarget] = useState<Champion | null>(null)

  async function confirmDelete() {
    if (!deleteTarget) return
    await vm.removeChampion(deleteTarget)
    setDeleteTarget(null)
  }

  return (
    <div className='flex flex-col gap-4'>
      <PaginationControls
        currentPage={vm.currentPage}
        totalPage={vm.totalPage}
        usersPerPage={vm.perPage}
        canReset={vm.canReset}
        onUserPerPageChange={(val) => {
          vm.setPerPage(Number(val))
          vm.setCurrentPage(1)
        }}
        onFirstPage={() => vm.setCurrentPage(1)}
        onPreviousPage={() => vm.setCurrentPage(Math.max(1, vm.currentPage - 1))}
        onNextPage={() => vm.setCurrentPage(vm.currentPage + 1)}
        onLastPage={() => vm.setCurrentPage(vm.totalPage)}
        onResetPagination={vm.resetAll}
      />

      <ChampionsIoButtons
        onImported={vm.reload}
        onError={vm.setError}
      />

      <ChampionsFilterBar
        filters={vm.filters}
        activeCount={vm.activeCount}
        canReset={vm.canReset}
        seasons={vm.seasons}
        selectedSeasonId={vm.selectedSeasonId}
        sagaDisabled={vm.sagaDisabled}
        onSeasonChange={vm.setSelectedSeasonId}
        onFilterChange={vm.setFilter}
        onReset={vm.resetAll}
      />

      <ChampionsActiveFilters
        filters={vm.filters}
        onClear={vm.clearFilter}
        onClearAll={vm.resetAll}
      />

      {vm.error && (
        <ErrorBanner
          message={vm.error}
          variant='inline'
        />
      )}

      <ChampionsTable
        champions={vm.champions}
        isLoading={vm.isLoading}
        perPage={vm.perPage}
        orderBy={vm.orderBy}
        orderDir={vm.orderDir}
        onSort={vm.toggleSort}
        sagaDisabled={vm.sagaDisabled}
        onToggleAttribute={vm.toggleAttribute}
        onSaveAlias={vm.saveAlias}
        onDelete={setDeleteTarget}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t.champions.deleteConfirmTitle}
        description={t.champions.deleteConfirmDesc.replace('{name}', deleteTarget?.name ?? '')}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={confirmDelete}
        variant='destructive'
      />
    </div>
  )
}
