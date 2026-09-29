import { api, jsonBody } from '@/app/services/utils'

// ─── Moderation Service ──────────────────────────────────

// ─── Types ───────────────────────────────────────────────

export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface NoteReport {
  id: string
  note_id: string
  alliance_id: string
  alliance_name: string
  battlegroup: number
  node_number: number
  note_content: string
  note_deleted: boolean
  reporter_pseudo: string
  reason: string | null
  status: string
  created_at: string
}

export interface PaginatedReports {
  items: NoteReport[]
  total: number
  page: number
  size: number
  pages: number
}

export interface NoteRevision {
  id: string
  content: string
  edited_by_user_id: string | null
  edited_by_pseudo: string | null
  is_deletion: boolean
  edited_at: string
}

export interface Mute {
  id: string
  user_id: string
  user_login: string
  reason: string
  created_at: string
  expires_at: string | null
  lifted_at: string | null
  muted_by_login: string | null
}

export interface Warn {
  id: string
  user_id: string
  user_login: string
  reason: string
  created_at: string
  warned_by_login: string | null
}

export interface MyModeration {
  mute: { reason: string; expires_at: string | null } | null
  warns: { reason: string; created_at: string }[]
}

// ─── Reader API ──────────────────────────────────────────

export async function reportNote(noteId: string, reason?: string): Promise<void> {
  await api(
    `/notes/${noteId}/report`,
    'Failed to report note',
    jsonBody('POST', { reason: reason ?? null })
  )
}

export async function getMyModeration(): Promise<MyModeration> {
  return api('/me/moderation', 'Failed to load moderation status')
}

// ─── Admin API ───────────────────────────────────────────

export async function listReports(status?: string, page = 1): Promise<PaginatedReports> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  const suffix = params.toString() ? `?${params}` : ''
  return api(`/admin/note-reports${suffix}`, 'Failed to load note reports')
}

export async function resolveReport(reportId: string, action: 'delete' | 'dismiss'): Promise<void> {
  await api(
    `/admin/note-reports/${reportId}/resolve`,
    'Failed to resolve report',
    jsonBody('POST', { action })
  )
}

export async function getRevisions(noteId: string): Promise<NoteRevision[]> {
  return api(`/admin/notes/${noteId}/revisions`, 'Failed to load note revisions')
}

export async function muteUser(
  userId: string,
  reason: string,
  expiresAt?: string | null
): Promise<void> {
  await api(
    `/admin/users/${userId}/mute`,
    'Failed to mute user',
    jsonBody('POST', { reason, expires_at: expiresAt ?? null })
  )
}

export async function liftMute(userId: string): Promise<void> {
  await api(`/admin/users/${userId}/mute`, 'Failed to lift mute', { method: 'DELETE' })
}

export async function warnUser(userId: string, reason: string): Promise<void> {
  await api(`/admin/users/${userId}/warn`, 'Failed to warn user', jsonBody('POST', { reason }))
}

export async function listMutes(activeOnly?: boolean): Promise<Mute[]> {
  const params = new URLSearchParams()
  if (activeOnly !== undefined) params.set('active_only', String(activeOnly))
  const suffix = params.toString() ? `?${params}` : ''
  return api(`/admin/mutes${suffix}`, 'Failed to load mutes')
}

export async function listWarns(userId?: string): Promise<Warn[]> {
  const params = new URLSearchParams()
  if (userId) params.set('user_id', userId)
  const suffix = params.toString() ? `?${params}` : ''
  return api(`/admin/warns${suffix}`, 'Failed to load warns')
}
