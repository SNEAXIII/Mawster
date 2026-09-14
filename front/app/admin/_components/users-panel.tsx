'use client'
import Loading from '@/app/admin/dashboard/loading'
import RenderUserDashboard from '@/components/dashboard/table/render-user-dashboard'
import PaginationControls from '@/components/dashboard/pagination/pagination-controls'
import { SearchInput } from '@/components/search-input'
import { useI18n } from '@/app/i18n'
import { useUsersViewModel } from '../_viewmodels/use-users-viewmodel'

interface UsersPanelProps {
  currentUserRole: string | undefined
}

export default function UsersPanel({ currentUserRole }: Readonly<UsersPanelProps>) {
  const { t } = useI18n()
  const vm = useUsersViewModel()

  return (
    <>
      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
        <SearchInput
          placeholder={t.dashboard.searchPlaceholder}
          value={vm.searchQuery}
          onChange={vm.handleSearchChange}
          className='w-full sm:w-72'
        />
        <PaginationControls
          currentPage={vm.currentPage}
          totalPage={vm.totalPage}
          usersPerPage={vm.usersPerPage}
          canReset={vm.canReset}
          onUserPerPageChange={vm.handleUsersPerPageChange}
          onFirstPage={() => vm.setCurrentPage(1)}
          onPreviousPage={() => vm.setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => vm.setCurrentPage((p) => p + 1)}
          onLastPage={() => vm.setCurrentPage(vm.totalPage)}
          onResetPagination={vm.resetPagination}
        />
      </div>
      {vm.isLoading ? (
        <Loading usersPerPage={vm.usersPerPage} />
      ) : (
        <RenderUserDashboard
          users={vm.users}
          role={vm.selectedRole}
          status={vm.selectedStatus}
          fetchUsersError={vm.fetchUsersError}
          onRoleChange={vm.handleRoleChange}
          onStatusChange={vm.handleStatusChange}
          onUserAction={vm.runUserAction}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  )
}
