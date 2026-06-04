const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export type SeasonFormat = 'regular' | 'big_thing';
export type SeasonStatus = 'upcoming' | 'active' | 'ended';

export interface Season {
  id: string;
  number: number;
  status: SeasonStatus;
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

export async function openSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/open`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to open season');
  return res.json();
}

export async function closeSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/close`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to close season');
  return res.json();
}

export async function revertSeason(id: string): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons/${id}/revert`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to revert season');
  return res.json();
}
