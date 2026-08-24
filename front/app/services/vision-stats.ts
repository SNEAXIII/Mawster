// ─── Admin AI-import stats service ───────────────────────
// Read-only aggregates over the vision (AI) roster imports. Admin-only on the
// backend; nothing here is reachable from a normal user session.

const PROXY = '/api/back'

const jsonHeaders: HeadersInit = { Accept: 'application/json' }

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data = await response.json().catch(() => ({}))
  const msg = data.message ?? data.detail ?? fallback
  const err = new Error(`Erreur ${response.status}: ${msg}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

// ─── Types ───────────────────────────────────────────────

export interface VisionStatsOverview {
  imports_total: number
  imports_confirmed: number
  imports_cancelled: number
  imports_failed: number
  imports_in_progress: number
  imports_all_time: number
  screens_total: number
  jobs_total: number
  jobs_failed: number
  predictions_total: number
  distinct_users: number
  distinct_game_accounts: number
  shared_dataset_imports: number
  avg_confidence: number | null
  unidentified_predictions: number
  reranked_predictions: number
  confirm_rate: number
  job_failure_rate: number
  avg_screens_per_import: number
}

export interface VisionDailyPoint {
  day: string
  imports: number
  screens: number
  confirmed: number
}

export interface VisionJobError {
  error: string
  count: number
}

export interface VisionStats {
  days: number
  overview: VisionStatsOverview
  daily: VisionDailyPoint[]
  top_errors: VisionJobError[]
}

export interface VisionUserStat {
  user_id: string
  login: string
  role: string
  game_pseudos: string[]
  imports_total: number
  imports_confirmed: number
  imports_cancelled: number
  imports_failed: number
  screens_total: number
  predictions_total: number
  shared_dataset_imports: number
  confirm_rate: number
  first_import_at: string | null
  last_import_at: string | null
}

export interface VisionImportRow {
  id: string
  created_at: string
  status: string
  user_id: string
  login: string
  game_account_id: string
  game_pseudo: string
  screens_total: number
  screens_done: number
  jobs_failed: number
  predictions_total: number
  share_dataset: boolean
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export type PaginatedVisionUsers = Paginated<VisionUserStat>
export type PaginatedVisionImports = Paginated<VisionImportRow>

// `imports_total` is the leaderboard default; the rest are the columns the
// table lets an admin sort on. Kept in sync with the backend whitelist.
export type VisionUserSort =
  | 'imports_total'
  | 'imports_confirmed'
  | 'imports_cancelled'
  | 'imports_failed'
  | 'screens_total'
  | 'last_import_at'

// 0 means "all time" — the backend reads it that way too.
export const ALL_TIME_DAYS = 0

// ─── API ─────────────────────────────────────────────────

export async function getVisionStats(days: number): Promise<VisionStats> {
  const response = await fetch(`${PROXY}/admin/vision/stats?days=${days}`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Failed to load AI import stats')
  return response.json()
}

export async function getVisionUserStats(params: {
  days: number
  page?: number
  size?: number
  sortBy?: VisionUserSort
  sortOrder?: 'asc' | 'desc'
}): Promise<PaginatedVisionUsers> {
  const query = new URLSearchParams({
    days: String(params.days),
    page: String(params.page ?? 1),
    size: String(params.size ?? 10),
    sort_by: params.sortBy ?? 'imports_total',
    sort_order: params.sortOrder ?? 'desc',
  })
  const response = await fetch(`${PROXY}/admin/vision/users?${query}`, { headers: jsonHeaders })
  await throwOnError(response, 'Failed to load AI importer stats')
  return response.json()
}

export async function getVisionImports(params: {
  days: number
  page?: number
  size?: number
  status?: string
  userId?: string
}): Promise<PaginatedVisionImports> {
  const query = new URLSearchParams({
    days: String(params.days),
    page: String(params.page ?? 1),
    size: String(params.size ?? 10),
  })
  if (params.status) query.set('status', params.status)
  if (params.userId) query.set('user_id', params.userId)
  const response = await fetch(`${PROXY}/admin/vision/imports?${query}`, { headers: jsonHeaders })
  await throwOnError(response, 'Failed to load AI imports')
  return response.json()
}
