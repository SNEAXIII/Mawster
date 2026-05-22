const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export interface AppConfigData {
  current_season_id: string | null;
  off_season_big_thing: boolean;
}

export async function getAppConfig(): Promise<AppConfigData> {
  const res = await fetch(`${PROXY}/admin/config`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load app config');
  return res.json();
}

export async function setCurrentSeason(season_id: string | null): Promise<AppConfigData> {
  const res = await fetch(`${PROXY}/admin/config/current-season`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ season_id }),
  });
  if (!res.ok) throw new Error('Failed to set current season');
  return res.json();
}

export async function setOffSeasonBigThing(enabled: boolean): Promise<AppConfigData> {
  const res = await fetch(`${PROXY}/admin/config/off-season-big-thing`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to set off-season big thing');
  return res.json();
}
