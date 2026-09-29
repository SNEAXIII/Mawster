import { PROXY, api, jsonBody, jsonHeaders } from '@/app/services/utils'

export type SeasonFormat = 'regular' | 'big_thing'
export type SeasonStatus = 'upcoming' | 'active' | 'ended'

export interface Season {
  id: string
  number: number
  status: SeasonStatus
  format: SeasonFormat
  max_defenders_per_player: number
  max_attackers_per_member: number
  node_count: number
}

export async function getCurrentSeason(): Promise<Season | null> {
  const res = await fetch(`${PROXY}/seasons/current`, { headers: jsonHeaders })
  if (!res.ok) return null
  return res.json()
}

export async function listSeasons(): Promise<Season[]> {
  return api('/admin/seasons', 'Failed to load seasons')
}

export async function createSeason(
  number: number,
  format: SeasonFormat = 'regular'
): Promise<Season> {
  return api('/admin/seasons', 'Failed to create season', jsonBody('POST', { number, format }))
}

export async function openSeason(id: string): Promise<Season> {
  return api(`/admin/seasons/${id}/open`, 'Failed to open season', { method: 'PATCH' })
}

export async function closeSeason(id: string): Promise<Season> {
  return api(`/admin/seasons/${id}/close`, 'Failed to close season', { method: 'PATCH' })
}

export async function revertSeason(id: string): Promise<Season> {
  return api(`/admin/seasons/${id}/revert`, 'Failed to revert season', { method: 'PATCH' })
}
