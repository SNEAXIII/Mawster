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

/** Tailwind classes for each rarity tier */
export const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '6r4': { bg: 'bg-purple-600',  text: 'text-white', border: 'border-purple-500' },
  '6r5': { bg: 'bg-red-600',     text: 'text-white', border: 'border-red-500' },
  '7r1': { bg: 'bg-blue-500',    text: 'text-white', border: 'border-blue-400' },
  '7r2': { bg: 'bg-green-500',   text: 'text-white', border: 'border-green-400' },
  '7r3': { bg: 'bg-yellow-500',  text: 'text-black', border: 'border-yellow-400' },
  '7r4': { bg: 'bg-orange-500',  text: 'text-white', border: 'border-orange-400' },
  '7r5': { bg: 'bg-rose-700',    text: 'text-white', border: 'border-rose-600' },
};

// ─── Champion classes ────────────────────────────────────
export enum ChampionClass {
  SKILL = 'Skill',
  COSMIC = 'Cosmic',
  MUTANT = 'Mutant',
  MYSTIC = 'Mystic',
  TECH = 'Tech',
  SCIENCE = 'Science',
}

/** Tailwind color config per champion class */
export const CLASS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  Skill:   { bg: 'bg-red-600',     text: 'text-white', border: 'border-red-500',    label: 'text-red-600 dark:text-red-400' },
  Cosmic:  { bg: 'bg-cyan-400',    text: 'text-black', border: 'border-cyan-300',   label: 'text-cyan-600 dark:text-cyan-400' },
  Mutant:  { bg: 'bg-yellow-400',  text: 'text-black', border: 'border-yellow-300', label: 'text-yellow-600 dark:text-yellow-400' },
  Mystic:  { bg: 'bg-purple-600',  text: 'text-white', border: 'border-purple-500', label: 'text-purple-600 dark:text-purple-400' },
  Tech:    { bg: 'bg-blue-800',    text: 'text-white', border: 'border-blue-700',   label: 'text-blue-700 dark:text-blue-400' },
  Science: { bg: 'bg-green-600',   text: 'text-white', border: 'border-green-500',  label: 'text-green-600 dark:text-green-400' },
};

/** Return class colors with a safe fallback */
export function getClassColors(championClass: string) {
  return CLASS_COLORS[championClass] ?? { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-400', label: 'text-gray-500 dark:text-gray-400' };
}

/** Frame image URL per star level */
export function getStarFrameUrl(rarity: string): string {
  const stars = rarity.charAt(0); // '6' or '7'
  return `/static/frame/${stars}_stars.png`;
}

/** Extract the rank part from a rarity string, e.g. '7r5' → 'R5' */
export function getRankLabel(rarity: string): string {
  const parts = rarity.match(/(\d+)r(\d+)/);
  if (!parts) return rarity.toUpperCase();
  return `R${parts[2]}`;
}

/** Shorten a champion name for card display.
 *  Removes parenthesized suffixes: "Spider-Woman (Jessica Drew)" → "Spider-Woman" */
export function shortenChampionName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').trim();
}

/** Numeric sort value for a rarity string (higher = better). Used for descending sort. */
export function raritySortValue(rarity: string): number {
  const parts = rarity.match(/(\d+)r(\d+)/);
  if (!parts) return 0;
  return parseInt(parts[1]) * 10 + parseInt(parts[2]);
}

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
  champion_name: string;
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

export const updateChampionInRoster = async (
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
  await throwOnError(response, "Erreur lors de la mise à jour du roster");
  return response.json();
};

export const bulkUpdateRoster = async (
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
  await throwOnError(response, "Erreur lors de la mise à jour en masse du roster");
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

/** Compute the next rarity (one rank up within the same star level).
 *  A 6★ champion stays 6★ — cannot jump to 7★.
 *  Returns null if already at max rank for that star level. */
export function getNextRarity(rarity: string): string | null {
  const parts = rarity.match(/^(\d+)r(\d+)$/);
  if (!parts) return null;
  const stars = parts[1];
  const rank = parseInt(parts[2]);
  const nextRarity = `${stars}r${rank + 1}` as ChampionRarity;
  if (!RARITIES.includes(nextRarity)) return null;
  return nextRarity;
}

export const upgradeChampionRank = async (
  championUserId: string,
): Promise<RosterEntry> => {
  const response = await fetch(
    `${PROXY}/champion-users/${championUserId}/upgrade`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
    },
  );
  await throwOnError(response, "Erreur lors de l'amélioration du champion");
  return response.json();
};

// ─── Upgrade Requests ────────────────────────────────────

export interface UpgradeRequest {
  id: string;
  champion_user_id: string;
  requester_game_account_id: string;
  requester_pseudo: string;
  requested_rarity: string;
  current_rarity: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  created_at: string;
  done_at: string | null;
}

export const createUpgradeRequest = async (
  championUserId: string,
  requestedRarity: string,
): Promise<UpgradeRequest> => {
  const response = await fetch(`${PROXY}/champion-users/upgrade-requests`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      champion_user_id: championUserId,
      requested_rarity: requestedRarity,
    }),
  });
  await throwOnError(response, "Erreur lors de la demande d'upgrade");
  return response.json();
};

export const getUpgradeRequests = async (
  gameAccountId: string,
): Promise<UpgradeRequest[]> => {
  const response = await fetch(
    `${PROXY}/champion-users/upgrade-requests/by-account/${gameAccountId}`,
    { headers: jsonHeaders },
  );
  await throwOnError(response, 'Erreur lors de la récupération des demandes');
  return response.json();
};

export const cancelUpgradeRequest = async (
  requestId: string,
): Promise<void> => {
  const response = await fetch(
    `${PROXY}/champion-users/upgrade-requests/${requestId}`,
    { method: 'DELETE', headers: jsonHeaders },
  );
  await throwOnError(response, "Erreur lors de l'annulation de la demande");
};
