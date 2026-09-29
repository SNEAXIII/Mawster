import type { ChampionUsageItem } from '@/app/services/statistics'
import type { Perspective } from '@/app/components/statistics/member-champion-chart'
import { api } from '@/app/services/utils'

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
  win_streak: number
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
  return api(`/statistics/player/${accountId}/seasons`, 'Failed to load seasons')
}

export async function getPlayerStats(accountId: string, seasonId?: string): Promise<PlayerStats> {
  const q = seasonId ? `?season_id=${seasonId}` : ''
  return api(`/statistics/player/${accountId}${q}`, 'Failed to load player stats')
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
  return api(
    `/statistics/player/${accountId}/champion-usage${query}`,
    'Failed to load champion usage'
  )
}
