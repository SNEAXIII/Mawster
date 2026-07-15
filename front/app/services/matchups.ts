const PROXY = '/api/back'

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
}

export type MatchupVerdict = 'discouraged' | 'ok' | 'good'
export type MatchupTargetType = 'defender' | 'node'

export interface ChampionRef {
  champion_id: string
  champion_name: string
  champion_class: string
  image_url: string | null
}

export interface MatchupSynergy extends ChampionRef {
  is_required: boolean
}

export interface MatchupRating {
  id: string
  champion: ChampionRef
  target_type: MatchupTargetType
  defender: ChampionRef | null
  node_number: number | null
  verdict: MatchupVerdict
  prefight: ChampionRef | null
  synergies: MatchupSynergy[]
  updated_at: string
}

// The combined outcome of a whole fight. `score` is null exactly when `is_discouraged` — a
// discouraged fight is not a fight worth zero points.
export interface MatchupScoredFight {
  is_discouraged: boolean
  score: number | null
}

// The content of one rating: how the fight goes, and what it costs to take it. A rating targets
// a single side (a defender, or a node), so a full fight is always two of these.
export interface MatchupRatedSide {
  verdict: MatchupVerdict
  synergies: MatchupSynergy[]
  prefight: ChampionRef | null
}

export interface MatchupEvaluationRow extends MatchupScoredFight {
  champion: ChampionRef
  // Each rated side in full — this is what the detail dialog opens. `synergies` and `prefight`
  // below stay the merged view of both sides, which is what the list columns show and what
  // playability is computed from.
  defender: MatchupGridAxisEntry | null
  node: MatchupGridAxisEntry | null
  synergies: MatchupSynergy[]
  prefight: ChampionRef | null
  is_playable: boolean | null
  instance_label: string | null
  missing_champions: ChampionRef[]
  is_on_defense: boolean | null
}

export interface MatchupTargetInput {
  target_type: MatchupTargetType
  defender_champion_id?: string
  node_number?: number
  verdict: MatchupVerdict
  prefight_champion_id?: string | null
  synergies: { champion_id: string; is_required: boolean }[]
}

export interface MatchupUpsertBody {
  champion_id: string
  targets: MatchupTargetInput[]
}

export interface MatchupFilters {
  champion_id?: string | null
  defender_champion_id?: string | null
  node_number?: number | null
}

export interface MatchupEvaluationParams extends MatchupFilters {
  game_account_id?: string | null
}

// A rated side, named by what it was rated against. Also what the detail dialog renders as one
// of its two panels, wherever a fight is opened from.
export interface MatchupGridAxisEntry extends MatchupRatedSide {
  defender: ChampionRef | null
  node_number: number | null
}

// Both sides are on the grid's axes here (the attacker is fixed), so the cell only says how the
// pair combines.
export interface MatchupGridCell extends MatchupScoredFight {
  defender_champion_id: string
  node_number: number
}

export interface MatchupGridResponse {
  attacker: ChampionRef
  is_owned: boolean | null
  instance_label: string | null
  is_on_defense: boolean | null
  defenders: MatchupGridAxisEntry[]
  nodes: MatchupGridAxisEntry[]
  cells: MatchupGridCell[]
}

// Mirror of the attacker grid, centered on a defender: rows = attackers rated against it. The
// row is the "vs defender" side of every fight in it — that rating is the same for every node.
export interface MatchupDefenderGridRow extends MatchupRatedSide {
  attacker: ChampionRef
}

// The attacker varies per row here, so the "vs node" side is per (attacker, node) and cannot be
// a shared axis: it rides on the cell.
export interface MatchupDefenderGridCell extends MatchupScoredFight {
  attacker_champion_id: string
  node_number: number
  node: MatchupGridAxisEntry
}

export interface MatchupDefenderGridResponse {
  defender: ChampionRef
  attackers: MatchupDefenderGridRow[]
  cells: MatchupDefenderGridCell[]
}

function toQuery(params: Record<string, any>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function getMatchups(
  allianceId: string,
  filters: MatchupFilters = {}
): Promise<MatchupRating[]> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups${toQuery(filters)}`, {
    headers: jsonHeaders,
  })
  if (!res.ok) throw new Error('Failed to load matchups')
  return res.json()
}

export async function evaluateMatchups(
  allianceId: string,
  params: MatchupEvaluationParams
): Promise<MatchupEvaluationRow[]> {
  const res = await fetch(
    `${PROXY}/alliances/${allianceId}/matchups/evaluation${toQuery(params)}`,
    { headers: jsonHeaders }
  )
  if (!res.ok) throw new Error('Failed to evaluate matchups')
  return res.json()
}

export async function upsertMatchup(
  allianceId: string,
  body: MatchupUpsertBody
): Promise<MatchupRating[]> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to save matchup')
  return res.json()
}

export async function deleteMatchup(allianceId: string, ratingId: string): Promise<void> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups/${ratingId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  if (!res.ok) throw new Error('Failed to delete matchup')
}

export async function getMatchupGrid(
  allianceId: string,
  championId: string,
  gameAccountId?: string | null
): Promise<MatchupGridResponse> {
  const res = await fetch(
    `${PROXY}/alliances/${allianceId}/matchups/grid${toQuery({
      champion_id: championId,
      game_account_id: gameAccountId,
    })}`,
    { headers: jsonHeaders }
  )
  if (!res.ok) throw new Error('Failed to load matchup grid')
  return res.json()
}

export async function getMatchupDefenderGrid(
  allianceId: string,
  defenderChampionId: string,
  gameAccountId?: string | null
): Promise<MatchupDefenderGridResponse> {
  const res = await fetch(
    `${PROXY}/alliances/${allianceId}/matchups/grid-by-defender${toQuery({
      defender_champion_id: defenderChampionId,
      game_account_id: gameAccountId,
    })}`,
    { headers: jsonHeaders }
  )
  if (!res.ok) throw new Error('Failed to load defender matchup grid')
  return res.json()
}
