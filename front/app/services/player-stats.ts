import type { ChampionUsageItem } from '@/app/services/statistics'
import { Perspective } from '@/app/components/statistics/member-champion-chart'

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

export interface RatioEvolutionPoint {
  label: string
  ratio: number
  fights: number
}

export interface PlayerSeasonAlliance {
  name: string
  tag: string
}

export interface PlayerStatsCard {
  ratio: number
  total_kos: number
  total_not_fought: number
  total_fights: number
  total_assists: number
  wars_participated: number
}

export interface PlayerStats {
  card: PlayerStatsCard
  evolution: RatioEvolutionPoint[]
  alliances: PlayerSeasonAlliance[]
}

export interface PlayerSeasonOption {
  season_id: string
  number: number
  status: string
}

export async function getPlayerSeasons(accountId: string): Promise<PlayerSeasonOption[]> {
  const r = await fetch(`${PROXY}/statistics/player/${accountId}/seasons`, {
    headers: jsonHeaders,
  })
  await throwOnError(r, 'Failed to load seasons')
  return r.json()
}

export async function getPlayerStats(accountId: string, seasonId?: string): Promise<PlayerStats> {
  const q = seasonId ? `?season_id=${seasonId}` : ''
  const r = await fetch(`${PROXY}/statistics/player/${accountId}${q}`, { headers: jsonHeaders })
  await throwOnError(r, 'Failed to load player stats')
  return r.json()
}

export async function getPlayerChampionUsage(
  accountId: string,
  seasonId?: string,
  deathless?: boolean,
  perspective?: Perspective
): Promise<ChampionUsageItem[]> {
  const params = new URLSearchParams()
  if (seasonId) params.set('season_id', seasonId)
  if (deathless) params.set('deathless', 'true')
  if (perspective === 'defender') params.set('perspective', 'defender')
  const query = params.toString() ? `?${params.toString()}` : ''
  const r = await fetch(`${PROXY}/statistics/player/${accountId}/champion-usage${query}`, {
    headers: jsonHeaders,
  })
  await throwOnError(r, 'Failed to load champion usage')
  return r.json()
}
