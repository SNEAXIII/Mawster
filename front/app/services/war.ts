// ─── War Service ─────────────────────────────────────────

export interface War {
  id: string;
  alliance_id: string;
  opponent_name: string;
  created_by_pseudo: string;
  created_at: string;
}

export interface WarPlacement {
  id: string;
  war_id: string;
  battlegroup: number;
  node_number: number;
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  rarity: string;
  ascension: number;
  placed_by_pseudo: string | null;
  created_at: string;
}

export interface WarDefenseSummary {
  war_id: string;
  battlegroup: number;
  placements: WarPlacement[];
}

// ─── Helpers ─────────────────────────────────────────────

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
  (err as any).status = response.status;
  throw err;
}

// ─── War API ─────────────────────────────────────────────

export async function getWars(allianceId: string): Promise<War[]> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load wars');
  return response.json();
}

export async function createWar(allianceId: string, opponentName: string): Promise<War> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ opponent_name: opponentName }),
  });
  await throwOnError(response, 'Failed to create war');
  return response.json();
}

export async function getWarDefense(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<WarDefenseSummary> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}`,
    { headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to load war defense');
  return response.json();
}

export async function placeWarDefender(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  championId: string,
  stars: number,
  rank: number,
  ascension: number
): Promise<WarPlacement> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/place`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        node_number: nodeNumber,
        champion_id: championId,
        stars,
        rank,
        ascension,
      }),
    }
  );
  await throwOnError(response, 'Failed to place defender');
  return response.json();
}

export async function removeWarDefender(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<void> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}`,
    { method: 'DELETE', headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to remove defender');
}

export async function clearWarBg(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<void> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/clear`,
    { method: 'DELETE', headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to clear war battlegroup');
}
