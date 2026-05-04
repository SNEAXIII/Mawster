'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw } from 'lucide-react';
import PageNumberSelector from '@/components/dashboard/pagination/page-number-selector';
import { useI18n } from '@/app/i18n';

interface PaginationControlsProps {
  currentPage: number;
  totalPage: number;
  usersPerPage: number;
  canReset: boolean;
  onUserPerPageChange: (value: string) => void;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  onResetPagination: () => void;
}

export default function PaginationControls({
  currentPage,
  totalPage,
  usersPerPage,
  canReset,
  onUserPerPageChange,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onResetPagination,
}: Readonly<PaginationControlsProps>) {
  const { t } = useI18n();
  return (
    <div className='flex flex-col lg:flex-row gap-1 sm:gap-3'>
      <div className='flex justify-center lg:justify-start items-center flex-wrap gap-1 sm:gap-3 w-full sm:w-auto'>
        <Button
          onClick={onFirstPage}
          disabled={currentPage <= 1}
          variant='outline'
          data-cy='pagination-first'
        >
          <ChevronsLeft className='h-4 w-4' />
        </Button>
        <Button
          onClick={onPreviousPage}
          disabled={currentPage <= 1}
          variant='outline'
          data-cy='pagination-prev'
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <p className='flex-1 items-center justify-center text-center w-28 text-sm sm:text-base' data-cy='pagination-page-info'>
          {t.common.page} {totalPage ? currentPage : 0}/{totalPage}
        </p>
        <Button
          onClick={onNextPage}
          disabled={currentPage >= totalPage}
          variant='outline'
          data-cy='pagination-next'
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
        <Button
          onClick={onLastPage}
          disabled={currentPage >= totalPage}
          variant='outline'
          data-cy='pagination-last'
        >
          <ChevronsRight className='h-4 w-4' />
        </Button>
      </div>
      <div className='flex justify-center lg:justify-start items-center flex-wrap gap-1 sm:gap-3 w-full sm:w-auto'>
        <PageNumberSelector
          usersPerPage={usersPerPage}
          onValueChange={onUserPerPageChange}
        />
        <Button
          onClick={onResetPagination}
          disabled={!canReset}
          variant='outline'
          data-cy='pagination-reset'
        >
          {t.dashboard.pagination.resetFilters} <RotateCcw className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
}
