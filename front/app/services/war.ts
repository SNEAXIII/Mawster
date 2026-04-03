// ─── War Service ─────────────────────────────────────────

export interface War {
  id: string;
  alliance_id: string;
  opponent_name: string;
  status: 'active' | 'ended';
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
  ko_count: number;
  attacker_champion_user_id: string | null;
  attacker_game_account_id: string | null;
  attacker_pseudo: string | null;
  attacker_champion_name: string | null;
  attacker_champion_class: string | null;
  attacker_image_url: string | null;
  attacker_rarity: string | null;
}

export interface WarDefenseSummary {
  war_id: string;
  battlegroup: number;
  placements: WarPlacement[];
}

export interface AvailableAttacker {
  champion_user_id: string;
  game_account_id: string;
  game_pseudo: string;
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  rarity: string;
}

export interface WarSynergy {
  id: string;
  war_id: string;
  battlegroup: number;
  game_account_id: string;
  champion_user_id: string;
  target_champion_user_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  rarity: string;
  target_champion_name: string;
  game_pseudo: string;
  created_at: string;
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
  (err as Error & { status: number }).status = response.status;
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

export async function getCurrentWar(allianceId: string): Promise<War> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars/current`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load current war');
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
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}`, {
    headers: jsonHeaders,
  });
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

export async function endWar(allianceId: string, warId: string): Promise<War> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/wars/${warId}/end`, {
    method: 'POST',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to end war');
  return response.json();
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

// ─── Attacker API ─────────────────────────────────────────

export async function getAvailableAttackers(
  allianceId: string,
  warId: string,
  battlegroup: number,
  targetGameAccountId?: string
): Promise<AvailableAttacker[]> {
  const suffix = targetGameAccountId ? `/${targetGameAccountId}` : '';
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/available-attackers${suffix}`,
    { headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to load available attackers');
  return response.json();
}

export async function assignWarAttacker(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  championUserId: string
): Promise<WarPlacement> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ champion_user_id: championUserId }),
    }
  );
  await throwOnError(response, 'Failed to assign attacker');
  return response.json();
}

export async function removeWarAttacker(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<WarPlacement> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
    { method: 'DELETE', headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to remove attacker');
  return response.json();
}

export async function updateWarKo(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  koCount: number
): Promise<WarPlacement> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/ko`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ ko_count: koCount }),
    }
  );
  await throwOnError(response, 'Failed to update KO count');
  return response.json();
}

// ─── Synergy API ──────────────────────────────────────────

export async function getWarSynergies(
  allianceId: string,
  warId: string,
  battlegroup: number
): Promise<WarSynergy[]> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy`,
    { headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to load synergy attackers');
  return response.json();
}

export async function addWarSynergy(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string,
  targetChampionUserId: string
): Promise<WarSynergy> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        champion_user_id: championUserId,
        target_champion_user_id: targetChampionUserId,
      }),
    }
  );
  await throwOnError(response, 'Failed to add synergy attacker');
  return response.json();
}

export async function removeWarSynergy(
  allianceId: string,
  warId: string,
  battlegroup: number,
  championUserId: string
): Promise<void> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy/${championUserId}`,
    { method: 'DELETE', headers: jsonHeaders }
  );
  await throwOnError(response, 'Failed to remove synergy attacker');
}
