import type { SeasonFormat } from '@/app/services/season'
import { api, jsonBody } from '@/app/services/utils'
import type { WarBoost } from '@/app/services/war'

export interface AllianceSnapshotStat {
  alliance_id: string
  alliance_name: string
  war_count: number
}

export interface ForceSnapshotResult {
  snapshotted: number
  skipped: number
}

export interface SynergyRecord {
  champion_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
  stars: number
  ascension: number
}

export interface PrefightRecord {
  champion_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
  stars: number
  ascension: number
}

export interface FightRecord {
  id: string
  war_id?: string | null
  alliance_id: string
  alliance_name: string
  alliance_tag?: string | null
  season_id: string | null
  season_number?: number | null
  season_format?: SeasonFormat | null
  game_account_pseudo?: string | null
  node_number: number
  tier?: number | null
  champion_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
  stars?: number | null
  rank?: number | null
  ascension?: number | null
  is_saga_attacker?: boolean | null
  defender_champion_id: string
  defender_champion_name: string
  defender_champion_class: string
  defender_image_url: string | null
  defender_stars?: number | null
  defender_rank?: number | null
  defender_ascension?: number | null
  defender_is_saga_defender?: boolean | null
  ko_count: number
  is_planning_error: boolean
  assisted: boolean
  war_boost: WarBoost | null
  has_defense_boost: boolean
  has_power_boost: boolean
  has_specials_boost: boolean
  synergies: SynergyRecord[]
  prefights: PrefightRecord[]
  is_imported?: boolean
  created_at?: string | null
  note?: string | null
  note_id?: string | null
  note_blocked?: boolean
  note_author?: string | null
}

export interface PaginatedFightRecords {
  items: FightRecord[]
  total: number
  page: number
  size: number
  pages: number
}

export interface Season {
  id: string
  number: number
  status: 'upcoming' | 'active' | 'ended'
}

export type FightRecordSource = 'all' | 'imported' | 'non_imported'

export interface FightRecordFilters {
  champion_id?: string
  defender_champion_id?: string
  node_number?: number
  tier?: number
  season_selector?: string
  season_id?: string
  season_format?: SeasonFormat
  alliance_id?: string
  game_account_pseudo?: string
  planning_error_only?: boolean
  source?: FightRecordSource
  page?: number
  size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface AccessibleAlliance {
  id: string
  name: string
  tag: string
}

export async function getAccessibleAlliances(): Promise<AccessibleAlliance[]> {
  return api('/alliances/accessible', 'Failed to load accessible alliances')
}

export async function getSeasons(): Promise<Season[]> {
  return api('/seasons', 'Failed to load seasons')
}

export async function getSnapshotStats(): Promise<AllianceSnapshotStat[]> {
  return api('/admin/wars/snapshot-stats', 'Failed to load snapshot stats')
}

export async function forceSnapshotWars(): Promise<ForceSnapshotResult> {
  return api('/admin/wars/force-snapshot', 'Failed to force snapshot', { method: 'POST' })
}

export async function getFightRecords(
  filters?: FightRecordFilters
): Promise<PaginatedFightRecords> {
  const qs = new URLSearchParams()
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value))
      }
    }
  }
  const query = qs.toString()
  const params = query ? `?${query}` : ''
  return api(`/fight-records${params}`, 'Failed to load fight records')
}

export interface ImportRow {
  champion_id: string
  defender_champion_id: string
  node_number: number
  season_name: string
  ko_count: number
}

export interface ImportFightRecordsRequest {
  rows: ImportRow[]
}

export interface ImportFightRecordsResponse {
  imported: number
  skipped: number
}

export async function importFightRecords(
  allianceId: string,
  payload: ImportFightRecordsRequest
): Promise<ImportFightRecordsResponse> {
  return api(
    `/alliances/${allianceId}/fight-records/import`,
    'Failed to import fight records',
    jsonBody('POST', payload)
  )
}
