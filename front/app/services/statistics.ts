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
  ratio: number;
  ratio_mb: number;
}

export async function getCurrentSeasonStatistics(allianceId: string): Promise<PlayerSeasonStats[]> {
  const response = await fetch(`${PROXY}/statistics/current_season/${allianceId}`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load season statistics');
  return response.json();
}
