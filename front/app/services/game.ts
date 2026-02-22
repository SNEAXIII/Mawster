// ─── Types ───────────────────────────────────────────────
export interface GameAccount {
  id: string;
  user_id: string;
  alliance_id: string | null;
  alliance_group: number | null;
  game_pseudo: string;
  is_primary: boolean;
  created_at: string;
}

export interface AllianceMember {
  id: string;
  user_id: string;
  game_pseudo: string;
  alliance_group: number | null;
  is_owner: boolean;
  is_officer: boolean;
}

export interface Alliance {
  id: string;
  name: string;
  tag: string;
  owner_id: string;
  owner_pseudo: string;
  created_at: string;
  officers: AllianceOfficer[];
  members: AllianceMember[];
  member_count: number;
}

export interface AllianceOfficer {
  id: string;
  game_account_id: string;
  game_pseudo: string;
  assigned_at: string;
}

// ─── Helpers ─────────────────────────────────────────────
const PROXY = '/api/back';
const IS_DEV = process.env.NODE_ENV === 'development';

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

async function debugFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (IS_DEV) {
    const method = init?.method ?? 'GET';
    const url = typeof input === 'string' ? input : input.toString();
    const payload = init?.body ? JSON.parse(init.body as string) : undefined;
    console.debug(`[API] ${method} ${url}`, payload ?? '');
  }
  return fetch(input, init);
}

// ─── Game Accounts ───────────────────────────────────────
export async function getMyGameAccounts(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/game-accounts`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des comptes de jeu');
  return response.json();
}

export async function createGameAccount(
  game_pseudo: string,
  is_primary: boolean = false,
): Promise<GameAccount> {
  const response = await debugFetch(`${PROXY}/game-accounts`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_pseudo, is_primary }),
  });
  await throwOnError(response, 'Erreur lors de la création du compte de jeu');
  return response.json();
}

export async function updateGameAccount(
  id: string,
  game_pseudo: string,
  is_primary: boolean,
): Promise<GameAccount> {
  const response = await debugFetch(`${PROXY}/game-accounts/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ game_pseudo, is_primary }),
  });
  await throwOnError(response, 'Erreur lors de la mise à jour du compte de jeu');
  return response.json();
}

export async function deleteGameAccount(id: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/game-accounts/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression du compte de jeu');
}

// ─── Alliances ───────────────────────────────────────────
export async function getAllAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des alliances');
  return response.json();
}

export async function getMyAlliances(): Promise<Alliance[]> {
  const response = await debugFetch(`${PROXY}/alliances/mine`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération de vos alliances');
  return response.json();
}

export async function createAlliance(
  name: string,
  tag: string,
  owner_id: string,
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name, tag, owner_id }),
  });
  await throwOnError(response, "Erreur lors de la création de l'alliance");
  return response.json();
}

export async function deleteAlliance(id: string): Promise<void> {
  const response = await debugFetch(`${PROXY}/alliances/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, "Erreur lors de la suppression de l'alliance");
}

// ─── Eligibility ─────────────────────────────────────────
export async function getEligibleOwners(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/eligible-owners`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des comptes éligibles');
  return response.json();
}

export async function getEligibleOfficers(allianceId: string): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/eligible-officers`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des officiers éligibles');
  return response.json();
}

export async function getEligibleMembers(): Promise<GameAccount[]> {
  const response = await debugFetch(`${PROXY}/alliances/eligible-members`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des membres éligibles');
  return response.json();
}

// ─── Members ─────────────────────────────────────────────
export async function addMember(
  allianceId: string,
  gameAccountId: string,
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/members`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  });
  await throwOnError(response, "Erreur lors de l'ajout du membre");
  return response.json();
}

export async function removeMember(
  allianceId: string,
  gameAccountId: string,
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/members/${gameAccountId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors du retrait du membre');
  return response.json();
}

// ─── Officers ────────────────────────────────────────────
export async function addOfficer(
  allianceId: string,
  gameAccountId: string,
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/officers`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  });
  await throwOnError(response, "Erreur lors de l'ajout de l'adjoint");
  return response.json();
}

export async function removeOfficer(
  allianceId: string,
  gameAccountId: string,
): Promise<Alliance> {
  const response = await debugFetch(`${PROXY}/alliances/${allianceId}/officers`, {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ game_account_id: gameAccountId }),
  });
  await throwOnError(response, "Erreur lors du retrait de l'adjoint");
  return response.json();
}

// ─── Groups ──────────────────────────────────────────────
export async function setMemberGroup(
  allianceId: string,
  gameAccountId: string,
  group: number | null,
): Promise<Alliance> {
  const response = await debugFetch(
    `${PROXY}/alliances/${allianceId}/members/${gameAccountId}/group`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ group }),
    },
  );
  await throwOnError(response, 'Erreur lors du changement de groupe');
  return response.json();
}
