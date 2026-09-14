'use client'

import { useEffect, useRef, useState } from 'react'
import {
  type User,
  deleteUser,
  demoteFromAdmin,
  disableUser,
  enableUser,
  getUsers,
  promoteToAdmin,
} from '@/app/services/users'
import { possibleRoles, possibleStatus } from '@/app/lib/constants'
import { useI18n } from '@/app/i18n'

const BASE_CURRENT_PAGE = 1
const BASE_TOTAL_PAGE = 1
const BASE_USERS_PER_PAGE = 10
const BASE_SELECTED_STATUS = possibleStatus[0].value
const BASE_SELECTED_ROLE = possibleRoles[0].value

export const UserAction = {
  DISABLE: 'disable',
  ENABLE: 'enable',
  DELETE: 'delete',
  PROMOTE: 'promote',
  DEMOTE: 'demote',
} as const

export type UserAction = (typeof UserAction)[keyof typeof UserAction]

const USER_ACTION_CALLS: Record<UserAction, (userId: string) => Promise<true>> = {
  disable: disableUser,
  enable: enableUser,
  delete: deleteUser,
  promote: promoteToAdmin,
  demote: demoteFromAdmin,
}

export function useUsersViewModel() {
  const { t } = useI18n()

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(BASE_CURRENT_PAGE)
  const [totalPage, setTotalPage] = useState(BASE_TOTAL_PAGE)
  const [usersPerPage, setUsersPerPage] = useState(BASE_USERS_PER_PAGE)
  const [selectedStatus, setSelectedStatus] = useState(BASE_SELECTED_STATUS)
  const [selectedRole, setSelectedRole] = useState(BASE_SELECTED_ROLE)
  const [searchQuery, setSearchQuery] = useState('')
  const [canReset, setCanReset] = useState(false)
  const [fetchUsersError, setFetchUsersError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadUsers = async () => {
    setCanReset(false)
    setFetchUsersError('')
    if (!users.length) setIsLoading(true)
    try {
      const data = await getUsers(
        Math.max(currentPage, 1),
        usersPerPage,
        selectedStatus,
        selectedRole,
        searchQuery
      )
      setUsers(data.users)
      setCurrentPage(Math.min(currentPage, data.total_pages))
      setTotalPage(data.total_pages)
    } catch (error) {
      const err = error as Error & { status?: number }
      setFetchUsersError(
        err.status === 401 ? t.dashboard.errors.unauthorized : t.dashboard.errors.loadError
      )
    } finally {
      setIsLoading(false)
      setCanReset(
        !(
          usersPerPage === BASE_USERS_PER_PAGE &&
          selectedStatus === BASE_SELECTED_STATUS &&
          selectedRole === BASE_SELECTED_ROLE &&
          searchQuery === ''
        )
      )
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadUsers()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [currentPage, usersPerPage, selectedStatus, selectedRole, searchQuery])

  // The endpoints only acknowledge the write, so the page is reloaded from the API.
  const runUserAction = async (action: UserAction, userId: string) => {
    try {
      await USER_ACTION_CALLS[action](userId)
    } catch (error) {
      console.error(`Error during ${action} user:`, error)
      throw error
    }
    await loadUsers()
  }

  const goToPage1 = () => setCurrentPage(1)

  const resetPagination = () => {
    setUsersPerPage(BASE_USERS_PER_PAGE)
    setSelectedStatus(BASE_SELECTED_STATUS)
    setSelectedRole(BASE_SELECTED_ROLE)
    setSearchQuery('')
    setCurrentPage(BASE_CURRENT_PAGE)
  }

  return {
    users,
    isLoading,
    currentPage,
    setCurrentPage,
    totalPage,
    usersPerPage,
    canReset,
    fetchUsersError,
    selectedStatus,
    selectedRole,
    searchQuery,
    handleSearchChange: (val: string) => {
      setSearchQuery(val)
      goToPage1()
    },
    handleUsersPerPageChange: (val: string) => {
      setUsersPerPage(Number(val))
      goToPage1()
    },
    handleRoleChange: (val: string) => {
      setSelectedRole(val)
      goToPage1()
    },
    handleStatusChange: (val: string) => {
      setSelectedStatus(val)
      goToPage1()
    },
    resetPagination,
    runUserAction,
  }
}
