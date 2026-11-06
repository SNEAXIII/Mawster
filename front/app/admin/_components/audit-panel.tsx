'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import PaginationControls from '@/components/dashboard/pagination/pagination-controls'
import { Button } from '@/components/ui/button'
import { AUDIT_PURGE_SCOPES } from '@/app/services/admin-audit'
import { useAuditViewModel } from '../_viewmodels/use-audit-viewmodel'
import AuditFiltersBar from './audit-filters'
import AuditPurgeDialog from './audit-purge-dialog'
import AuditTable from './audit-table'

export default function AuditPanel() {
  const { t } = useI18n()
  const s = t.admin.audit
  const vm = useAuditViewModel()

  if (vm.loading) {
    return <p className='text-muted-foreground py-12 text-center'>{t.common.loading}</p>
  }

  const totalPage = vm.entries?.pages ?? 0

  return (
    <div
      className='flex flex-col gap-4'
      data-cy='audit-panel'
    >
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>{s.title}</h2>
          <p className='text-muted-foreground text-sm'>{s.subtitle}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {AUDIT_PURGE_SCOPES.map((scope) => (
            <AuditPurgeDialog
              key={scope}
              scope={scope}
              onPurge={vm.purge}
            />
          ))}
        </div>
      </div>

      <AuditFiltersBar
        filters={vm.filters}
        changeFilters={vm.changeFilters}
        options={vm.options}
        endpointOptions={vm.endpointOptions}
      />

      {vm.error || !vm.entries ? (
        <div className='flex flex-col items-center gap-3 py-12'>
          <p className='text-destructive text-sm'>{s.loadError}</p>
          <Button
            variant='outline'
            onClick={vm.reload}
            data-cy='audit-retry'
          >
            {s.retry}
          </Button>
        </div>
      ) : (
        <div
          className={cn('flex flex-col gap-4 transition-opacity', vm.refreshing && 'opacity-50')}
          aria-busy={vm.refreshing}
        >
          <AuditTable entries={vm.entries.items} />
          <PaginationControls
            currentPage={vm.page}
            totalPage={totalPage}
            usersPerPage={vm.size}
            canReset={vm.hasFilters}
            onUserPerPageChange={vm.changeSize}
            onFirstPage={() => vm.setPage(1)}
            onPreviousPage={() => vm.setPage(vm.page - 1)}
            onNextPage={() => vm.setPage(vm.page + 1)}
            onLastPage={() => vm.setPage(totalPage)}
            onResetPagination={vm.resetFilters}
          />
        </div>
      )}
    </div>
  )
}
