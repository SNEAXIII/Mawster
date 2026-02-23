import { Champion } from './champions';
import { GameAccount } from './game';

// ─── Types ───────────────────────────────────────────────
export enum ChampionRarity {
  SIX_R4 = '6r4',
  SIX_R5 = '6r5',
  SEVEN_R1 = '7r1',
  SEVEN_R2 = '7r2',
  SEVEN_R3 = '7r3',
  SEVEN_R4 = '7r4',
  SEVEN_R5 = '7r5',
}

export const RARITIES = Object.values(ChampionRarity);

export const RARITY_LABELS: Record<string, string> = {
  '6r4': '6★ R4',
  '6r5': '6★ R5',
  '7r1': '7★ R1',
  '7r2': '7★ R2',
  '7r3': '7★ R3',
  '7r4': '7★ R4',
  '7r5': '7★ R5',
};

export const SIGNATURE_PRESETS = [0, 20, 200];

export interface RosterEntry {
  id: string;
  game_account_id: string;
  champion_id: string;
  rarity: string;
  signature: number;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
}

export interface BulkChampionEntry {
  champion_id: string;
  rarity: string;
  signature: number;
}

interface ApiError {
  detail?: string;
  message?: string;
  statusCode?: number;
}

// ─── Helpers ─────────────────────────────────────────────
const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const data: ApiError = await response.json().catch(() => ({}));
  const msg = data.message ?? data.detail ?? fallback;
  const err = new Error(`Erreur ${response.status}: ${msg}`);
  (err as any).status = response.status;
  throw err;
}

// ─── Champions (non-admin, for search) ───────────────────
export const searchChampions = async (
  search: string,
  size: number = 20,
): Promise<{ champions: Champion[] }> => {
  const qs = new URLSearchParams({ page: '1', size: String(size) });
  if (search.trim()) qs.set('search', search.trim());
  const response = await fetch(`${PROXY}/admin/champions?${qs}`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la recherche de champions');
  return response.json();
};

// ─── Roster API ──────────────────────────────────────────
export const getRoster = async (
  gameAccountId: string,
): Promise<RosterEntry[]> => {
  const response = await fetch(
    `${PROXY}/champion-users/by-account/${gameAccountId}`,
    { headers: jsonHeaders },
  );
  await throwOnError(response, 'Erreur lors de la récupération du roster');
  return response.json();
};

export const addChampionToRoster = async (
  gameAccountId: string,
  championId: string,
  rarity: string,
  signature: number,
): Promise<RosterEntry> => {
  const response = await fetch(`${PROXY}/champion-users`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      game_account_id: gameAccountId,
      champion_id: championId,
      rarity,
      signature,
    }),
  });
  await throwOnError(response, "Erreur lors de l'ajout au roster");
  return response.json();
};

export const bulkAddToRoster = async (
  gameAccountId: string,
  champions: BulkChampionEntry[],
): Promise<RosterEntry[]> => {
  const response = await fetch(`${PROXY}/champion-users/bulk`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      game_account_id: gameAccountId,
      champions,
    }),
  });
  await throwOnError(response, "Erreur lors de l'ajout en masse au roster");
  return response.json();
};

export const deleteRosterEntry = async (
  championUserId: string,
): Promise<void> => {
  const response = await fetch(`${PROXY}/champion-users/${championUserId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression du roster');
};
