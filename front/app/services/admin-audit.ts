// ─── Admin Audit Entries service ─────────────────────────
import { api } from '@/app/services/utils'

export const AUDIT_RESULTS = ['success', 'refused', 'error'] as const
export type AuditResult = (typeof AUDIT_RESULTS)[number]

export const AUDIT_PURGE_SCOPES = ['anonymous', 'admins'] as const
export type AuditPurgeScope = (typeof AUDIT_PURGE_SCOPES)[number]

export interface AuditEntry {
  id: string
  created_at: string
  user_id: string | null
  user_login: string | null
  role: string | null
  method: string
  route: string
  status_code: number
  result: AuditResult
  details: Record<string, unknown> | null
}

export interface PaginatedAuditEntries {
  items: AuditEntry[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AuditFilterOptions {
  routers: { name: string; endpoints: { method: string; route: string }[] }[]
  accounts: { id: string; login: string }[]
}

/** Every value is empty when unset; dates are `YYYY-MM-DD` local days. */
export interface AuditFilters {
  router: string
  /** `METHOD /route`, the one key an endpoint has: a route alone spans several methods. */
  endpoint: string
  result: string
  userId: string
  dateFrom: string
  dateTo: string
}

// A date-only string parses as UTC: the explicit time keeps these on the viewer's local day.
const dayStart = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

export async function listAuditEntries(
  filters: AuditFilters,
  page: number,
  size: number
): Promise<PaginatedAuditEntries> {
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  if (filters.router) query.set('router', filters.router)
  if (filters.endpoint) {
    const [method, route] = filters.endpoint.split(' ')
    query.set('method', method)
    query.set('route', route)
  }
  if (filters.result) query.set('result', filters.result)
  if (filters.userId) query.set('user_id', filters.userId)
  if (filters.dateFrom) query.set('date_from', dayStart(filters.dateFrom))
  if (filters.dateTo) query.set('date_to', dayEnd(filters.dateTo))
  return api(`/admin/audit-entries?${query}`, 'Failed to load audit entries')
}

export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  return api('/admin/audit-entries/filters', 'Failed to load audit filters')
}

export async function purgeAuditEntries(
  scope: AuditPurgeScope,
  beforeDay: string
): Promise<{ deleted: number }> {
  const query = new URLSearchParams({ before: dayStart(beforeDay), scope })
  return api(`/admin/audit-entries?${query}`, 'Failed to purge audit entries', {
    method: 'DELETE',
  })
}
