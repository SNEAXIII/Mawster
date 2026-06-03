const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export type SeasonFormat = 'regular' | 'big_thing';

export interface Season {
  id: string;
  number: number;
  is_active: boolean;
  format: SeasonFormat;
  max_defenders_per_player: number;
  max_attackers_per_member: number;
  node_count: number;
}

export async function getCurrentSeason(): Promise<Season | null> {
  const res = await fetch(`${PROXY}/seasons/current`, { headers: jsonHeaders });
  if (!res.ok) return null;
  return res.json();
}

export async function listSeasons(): Promise<Season[]> {
  const res = await fetch(`${PROXY}/admin/seasons`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load seasons');
  return res.json();
}

export async function createSeason(
  number: number,
  format: SeasonFormat = 'regular'
): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ number, format }),
  });
  if (!res.ok) throw new Error('Failed to create season');
  return res.json();
}

export async function activateSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/activate`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to activate season');
  return res.json();
}

export async function deactivateSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/deactivate`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to deactivate season');
  return res.json();
}
