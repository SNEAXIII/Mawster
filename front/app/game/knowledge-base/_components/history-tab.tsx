'use client';
import Link from 'next/link';
import { useI18n } from '@/app/i18n';
import { useKnowledgeBaseViewModel } from '../_viewmodels/use-knowledge-base-viewmodel';
import KnowledgeBaseFilters from './knowledge-base-filters';
import KnowledgeBaseTable from './knowledge-base-table';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';

export default function HistoryTab() {
  const { t } = useI18n();
  const vm = useKnowledgeBaseViewModel();

  return (
    <div className='flex flex-col gap-4'>
      {vm.canImport && (
        <div className='flex justify-end'>
          <Link
            href='/game/knowledge-base/import'
            className='inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground'
            data-cy='import-records-link'
          >
            {t.game.knowledgeBase.importRecords}
          </Link>
        </div>
      )}
      {vm.data && (
        <PaginationControls
          currentPage={vm.page}
          totalPage={vm.data.pages}
          usersPerPage={vm.size}
          canReset={vm.page !== 1 || vm.hasActiveFilters}
          onUserPerPageChange={(v) => {
            vm.setSize(Number(v));
            vm.setPage(1);
          }}
          onFirstPage={() => vm.setPage(1)}
          onPreviousPage={() => vm.setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => vm.setPage((p) => Math.min(vm.data!.pages, p + 1))}
          onLastPage={() => vm.setPage(vm.data!.pages)}
          onResetPagination={() => {
            vm.setPage(1);
            vm.handleClearFilters();
          }}
        />
      )}
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

      {vm.data && (
        <KnowledgeBaseTable
          records={vm.data.items}
          loading={vm.loading}
          sortBy={vm.sortBy}
          sortOrder={vm.sortOrder}
          onSort={vm.handleSort}
        />
      )}
      {vm.error && <p className='text-destructive text-sm'>{vm.error}</p>}
    </div>
  );
}
