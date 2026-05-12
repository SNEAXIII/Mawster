const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  const msg = data.message ?? data.detail ?? fallback;
  const err = new Error(`Erreur ${response.status}: ${msg}`);
  (err as Error & { status: number }).status = response.status;
  throw err;
}

export interface PlayerSeasonStats {
  id: string;
  game_pseudo: string;
  alliance_group: number | null;
  total_kos: number;
  total_fights: number;
  total_miniboss: number;
  total_boss: number;
  total_not_fought: number;
  ratio: number;
  score: number;
}

export async function getCurrentSeasonStatistics(allianceId: string): Promise<PlayerSeasonStats[]> {
  const response = await fetch(`${PROXY}/statistics/current_season/${allianceId}`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load season statistics');
  return response.json();
}

export interface ChampionUsageItem {
  champion_id: string;
  champion_name: string;
  fight_count: number;
  total_kos: number;
  image_url: string | null;
}

export async function getChampionUsage(
  allianceId: string,
  gameAccountId?: string,
  warId?: string,
  allianceGroup?: number,
): Promise<ChampionUsageItem[]> {
  const params = new URLSearchParams();
  if (gameAccountId) params.set('game_account_id', gameAccountId);
  if (warId) params.set('war_id', warId);
  if (allianceGroup !== undefined) params.set('alliance_group', String(allianceGroup));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${PROXY}/statistics/champion-usage/${allianceId}${query}`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load champion usage');
  return response.json();
}
