'use client';
import React, { useEffect, useRef, useState } from 'react';
import { getUsers, User } from '@/app/services/users';
import Loading from '@/app/admin/dashboard/loading';
import RenderUserDashboard from '@/components/dashboard/table/render-user-dashboard';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';
import { SearchInput } from '@/components/search-input';
import { possibleRoles, possibleStatus } from '@/app/lib/constants';
import { useI18n } from '@/app/i18n';

const BASE_CURRENT_PAGE = 1;
const BASE_TOTAL_PAGE = 1;
const BASE_USERS_PER_PAGE = 10;
const BASE_SELECTED_STATUS = possibleStatus[0].value;
const BASE_SELECTED_ROLE = possibleRoles[0].value;

interface UsersPanelProps {
  currentUserRole: string | undefined;
}

export default function UsersPanel({ currentUserRole }: Readonly<UsersPanelProps>) {
  const { t } = useI18n();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(BASE_CURRENT_PAGE);
  const [totalPage, setTotalPage] = useState(BASE_TOTAL_PAGE);
  const [usersPerPage, setUsersPerPage] = useState(BASE_USERS_PER_PAGE);
  const [selectedStatus, setSelectedStatus] = useState(BASE_SELECTED_STATUS);
  const [selectedRole, setSelectedRole] = useState(BASE_SELECTED_ROLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [canReset, setCanReset] = useState(false);
  const [fetchUsersError, setFetchUsersError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = async () => {
    setCanReset(false);
    setFetchUsersError('');
    if (!users.length) setIsLoading(true);
    try {
      const data = await getUsers(
        Math.max(currentPage, 1),
        usersPerPage,
        selectedStatus,
        selectedRole,
        searchQuery
      );
      setUsers(data.users);
      setCurrentPage(Math.min(currentPage, data.total_pages));
      setTotalPage(data.total_pages);
    } catch (error) {
      const err = error as Error & { status?: number };
      setFetchUsersError(
        err.status === 401 ? t.dashboard.errors.unauthorized : t.dashboard.errors.loadError
      );
    } finally {
      setIsLoading(false);
      setCanReset(
        !(
          usersPerPage === BASE_USERS_PER_PAGE &&
          selectedStatus === BASE_SELECTED_STATUS &&
          selectedRole === BASE_SELECTED_ROLE &&
          searchQuery === ''
        )
      );
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentPage, usersPerPage, selectedStatus, selectedRole, searchQuery]);

  function resetPagination() {
    setUsersPerPage(BASE_USERS_PER_PAGE);
    setSelectedStatus(BASE_SELECTED_STATUS);
    setSelectedRole(BASE_SELECTED_ROLE);
    setSearchQuery('');
    setCurrentPage(BASE_CURRENT_PAGE);
  }

  function goToPage1() {
    setCurrentPage(1);
  }

  return (
    <>
      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
        <SearchInput
          placeholder={t.dashboard.searchPlaceholder}
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            goToPage1();
          }}
          className='w-full sm:w-72'
        />
        <PaginationControls
          currentPage={currentPage}
          totalPage={totalPage}
          usersPerPage={usersPerPage}
          canReset={canReset}
          onUserPerPageChange={(val) => {
            setUsersPerPage(Number(val));
            goToPage1();
          }}
          onFirstPage={() => setCurrentPage(1)}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => p + 1)}
          onLastPage={() => setCurrentPage(totalPage)}
          onResetPagination={resetPagination}
        />
      </div>
      {isLoading ? (
        <Loading usersPerPage={usersPerPage} />
      ) : (
        <RenderUserDashboard
          users={users}
          role={selectedRole}
          status={selectedStatus}
          fetchUsersError={fetchUsersError}
          onRoleChange={(val) => {
            setSelectedRole(val);
            goToPage1();
          }}
          onStatusChange={(val) => {
            setSelectedStatus(val);
            goToPage1();
          }}
          loadUsers={loadUsers}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  );
}
