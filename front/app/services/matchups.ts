const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export type MatchupVerdict = 'discouraged' | 'ok' | 'good';
export type MatchupTargetType = 'defender' | 'node';

export interface ChampionRef {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
}

export interface MatchupSynergy extends ChampionRef {
  is_required: boolean;
}

export interface MatchupRating {
  id: string;
  champion: ChampionRef;
  target_type: MatchupTargetType;
  defender: ChampionRef | null;
  node_number: number | null;
  verdict: MatchupVerdict;
  prefight: ChampionRef | null;
  synergies: MatchupSynergy[];
  updated_at: string;
}

export interface MatchupEvaluationRow {
  champion: ChampionRef;
  defender_verdict: MatchupVerdict | null;
  node_verdict: MatchupVerdict | null;
  is_discouraged: boolean;
  score: number | null;
  synergies: MatchupSynergy[];
  prefight: ChampionRef | null;
  is_playable: boolean | null;
  instance_label: string | null;
  missing_champions: ChampionRef[];
  is_on_defense: boolean | null;
}

export interface MatchupTargetInput {
  target_type: MatchupTargetType;
  defender_champion_id?: string;
  node_number?: number;
  verdict: MatchupVerdict;
  prefight_champion_id?: string | null;
  synergies: { champion_id: string; is_required: boolean }[];
}

export interface MatchupUpsertBody {
  champion_id: string;
  targets: MatchupTargetInput[];
}

export interface MatchupFilters {
  champion_id?: string | null;
  defender_champion_id?: string | null;
  node_number?: number | null;
}

export interface MatchupEvaluationParams extends MatchupFilters {
  game_account_id?: string | null;
}

function toQuery(params: Record<string, any>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getMatchups(
  allianceId: string,
  filters: MatchupFilters = {}
): Promise<MatchupRating[]> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups${toQuery(filters)}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to load matchups');
  return res.json();
}

export async function evaluateMatchups(
  allianceId: string,
  params: MatchupEvaluationParams
): Promise<MatchupEvaluationRow[]> {
  const res = await fetch(
    `${PROXY}/alliances/${allianceId}/matchups/evaluation${toQuery(params)}`,
    { headers: jsonHeaders }
  );
  if (!res.ok) throw new Error('Failed to evaluate matchups');
  return res.json();
}

export async function upsertMatchup(
  allianceId: string,
  body: MatchupUpsertBody
): Promise<MatchupRating[]> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save matchup');
  return res.json();
}

export async function deleteMatchup(allianceId: string, ratingId: string): Promise<void> {
  const res = await fetch(`${PROXY}/alliances/${allianceId}/matchups/${ratingId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to delete matchup');
}
