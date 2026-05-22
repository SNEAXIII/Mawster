const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export interface Season {
  id: string;
  number: number;
  is_big_thing: boolean;
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

export async function createSeason(number: number, is_big_thing = false): Promise<Season> {
  const res = await fetch(`${PROXY}/admin/seasons`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ number, is_big_thing }),
  });
  if (!res.ok) throw new Error('Failed to create season');
  return res.json();
}
