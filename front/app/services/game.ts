// ─── Types ───────────────────────────────────────────────
export interface GameAccount {
  id: number;
  user_id: string;
  alliance_id: number | null;
  game_pseudo: string;
  is_primary: boolean;
  created_at: string;
}

export interface Alliance {
  id: number;
  name: string;
  tag: string;
  description: string | null;
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
  (err as any).status = response.status;
  throw err;
}

// ─── Game Accounts ───────────────────────────────────────
export async function getMyGameAccounts(): Promise<GameAccount[]> {
  const response = await fetch(`${PROXY}/game-accounts`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des comptes de jeu');
  return response.json();
}

export async function createGameAccount(
  game_pseudo: string,
  is_primary: boolean = false,
): Promise<GameAccount> {
  const response = await fetch(`${PROXY}/game-accounts`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_pseudo, is_primary }),
  });
  await throwOnError(response, 'Erreur lors de la création du compte de jeu');
  return response.json();
}

export async function deleteGameAccount(id: number): Promise<void> {
  const response = await fetch(`${PROXY}/game-accounts/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression du compte de jeu');
}

// ─── Alliances ───────────────────────────────────────────
export async function getAllAlliances(): Promise<Alliance[]> {
  const response = await fetch(`${PROXY}/alliances`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des alliances');
  return response.json();
}

export async function createAlliance(
  name: string,
  tag: string,
  description?: string,
): Promise<Alliance> {
  const response = await fetch(`${PROXY}/alliances`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name, tag, description: description || null }),
  });
  await throwOnError(response, "Erreur lors de la création de l'alliance");
  return response.json();
}

export async function deleteAlliance(id: number): Promise<void> {
  const response = await fetch(`${PROXY}/alliances/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, "Erreur lors de la suppression de l'alliance");
}
