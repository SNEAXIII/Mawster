import { possibleRoles, possibleStatus } from '@/app/lib/constants'
import { PROXY, api, jsonBody, jsonHeaders } from '@/app/services/utils'

// ─── Types ───────────────────────────────────────────────
export interface User {
  login: string
  role: string
  id: string
  created_at: string
  last_login_date: string | null
  disabled_at: string | null
  deleted_at: string | null
}

export interface FetchUsersResponse {
  users: User[]
  total_users: number
  total_pages: number
  current_page: number
}

export interface ValidationErrors {
  [key: string]: { type: string; message: string }
}

export interface ApiErrorResponse {
  message: string
  errors: ValidationErrors
}

// Every call goes through the Next.js /api/back proxy.
// The backend JWT is injected server-side, never client-side.

// ─── API ─────────────────────────────────────────────────
export const getUsers = async (
  page: number = 1,
  size: number = 10,
  status: string | null = null,
  role: string | null = null,
  search: string | null = null
): Promise<FetchUsersResponse> => {
  const qs = new URLSearchParams({ page: String(page), size: String(size) })
  if (status && status !== possibleStatus[0].value) qs.set('status', status)
  if (role && role !== possibleRoles[0].value) qs.set('role', role)
  if (search?.trim()) qs.set('search', search.trim())

  return api(`/admin/users?${qs}`, 'Erreur lors de la récupération des utilisateurs')
}

export const deleteAccount = async (confirmation?: string): Promise<true> => {
  await api(
    '/user/delete',
    'Erreur lors de la suppression du compte',
    jsonBody('DELETE', { confirmation: confirmation ?? '' })
  )
  return true
}

export const updateLogin = async (login: string): Promise<void> => {
  await api('/user/login', 'Erreur lors de la mise à jour du pseudo', jsonBody('PATCH', { login }))
}

export const disableUser = async (userId: string): Promise<true> => {
  await api(`/admin/users/disable/${userId}`, "Erreur lors de la désactivation de l'utilisateur", {
    method: 'PATCH',
  })
  return true
}

export const enableUser = async (userId: string): Promise<true> => {
  await api(`/admin/users/enable/${userId}`, "Erreur lors de la réactivation de l'utilisateur", {
    method: 'PATCH',
  })
  return true
}

export const deleteUser = async (userId: string): Promise<true> => {
  await api(`/admin/users/delete/${userId}`, "Erreur lors de la suppression de l'utilisateur", {
    method: 'DELETE',
  })
  return true
}

export const promoteToAdmin = async (userId: string): Promise<true> => {
  const response = await fetch(`${PROXY}/admin/users/promote/${userId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ user_uuid_to_promote: userId }),
  })
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({
      message: 'Erreur lors de la promotion en administrateur',
      errors: {},
    }))
    const error = new Error(
      errorData.message ?? 'Erreur lors de la promotion en administrateur'
    ) as Error & { validationErrors?: ValidationErrors }
    error.validationErrors = errorData.errors
    throw error
  }
  return true
}

export const demoteFromAdmin = async (userId: string): Promise<true> => {
  await api(
    `/admin/users/demote/${userId}`,
    "Erreur lors de la rétrogradation de l'administrateur",
    { method: 'PATCH' }
  )
  return true
}
