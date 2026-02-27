// ─── Defense Placement Service ───────────────────────────

export interface DefensePlacement {
  id: string;
  alliance_id: string;
  battlegroup: number;
  node_number: number;
  champion_user_id: string;
  game_account_id: string;
  game_pseudo: string;
  champion_name: string;
  champion_class: string;
  champion_image_url: string | null;
  rarity: string;
  placed_by_id: string | null;
  placed_by_pseudo: string | null;
  created_at: string;
}

export interface DefenseSummary {
  alliance_id: string;
  battlegroup: number;
  placements: DefensePlacement[];
  member_defender_counts: Record<string, number>;
}

export interface ChampionOwner {
  champion_user_id: string;
  game_account_id: string;
  game_pseudo: string;
  rarity: string;
  stars: number;
  rank: number;
  signature: number;
  defender_count: number;
}

export interface AvailableChampion {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  owners: ChampionOwner[];
}

export interface BgMember {
  game_account_id: string;
  game_pseudo: string;
  defender_count: number;
  max_defenders: number;
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

// ─── Defense API ─────────────────────────────────────────

export async function getDefense(
  allianceId: string,
  battlegroup: number,
): Promise<DefenseSummary> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}`,
    { headers: jsonHeaders },
  );
  await throwOnError(response, 'Failed to load defense');
  return response.json();
}

export async function placeDefender(
  allianceId: string,
  battlegroup: number,
  nodeNumber: number,
  championUserId: string,
  gameAccountId: string,
): Promise<DefensePlacement> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}/place`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        node_number: nodeNumber,
        champion_user_id: championUserId,
        game_account_id: gameAccountId,
      }),
    },
  );
  await throwOnError(response, 'Failed to place defender');
  return response.json();
}

export async function removeDefender(
  allianceId: string,
  battlegroup: number,
  nodeNumber: number,
): Promise<void> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}/node/${nodeNumber}`,
    { method: 'DELETE', headers: jsonHeaders },
  );
  await throwOnError(response, 'Failed to remove defender');
}

export async function clearDefense(
  allianceId: string,
  battlegroup: number,
): Promise<void> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}/clear`,
    { method: 'DELETE', headers: jsonHeaders },
  );
  await throwOnError(response, 'Failed to clear defense');
}

export async function getAvailableChampions(
  allianceId: string,
  battlegroup: number,
): Promise<AvailableChampion[]> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}/available-champions`,
    { headers: jsonHeaders },
  );
  await throwOnError(response, 'Failed to load available champions');
  return response.json();
}

export async function getBgMembers(
  allianceId: string,
  battlegroup: number,
): Promise<BgMember[]> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/defense/bg/${battlegroup}/members`,
    { headers: jsonHeaders },
  );
  await throwOnError(response, 'Failed to load BG members');
  return response.json();
}
