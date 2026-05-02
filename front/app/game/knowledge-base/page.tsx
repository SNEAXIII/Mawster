'use client';
import { useI18n } from '@/app/i18n';
import { useKnowledgeBaseViewModel } from './_viewmodels/use-knowledge-base-viewmodel';
import KnowledgeBaseFilters from './_components/knowledge-base-filters';
import KnowledgeBaseTable from './_components/knowledge-base-table';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';

export default function KnowledgeBasePage() {
  const { t } = useI18n();
  const vm = useKnowledgeBaseViewModel();

  return (
    <div className='px-3 py-4 sm:p-6 space-y-4'>
      <h1 className='text-2xl font-bold'>{t.game.knowledgeBase.title}</h1>
      <KnowledgeBaseFilters
        filters={vm.filters}
        onChange={vm.handleFilterChange}
        onClear={vm.handleClearFilters}
      />
      <KnowledgeBaseTable
        records={vm.data?.items ?? []}
        loading={vm.loading}
        sortBy={vm.sortBy}
        sortOrder={vm.sortOrder}
        onSort={vm.handleSort}
      />
      {vm.data && (
        <PaginationControls
          currentPage={vm.page}
          totalPage={vm.data.pages}
          usersPerPage={vm.size}
          canReset={vm.page !== 1}
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
    </div>
  );
}
