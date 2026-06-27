const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
};

export interface PublicStats {
  active_alliances: number;
  participating_players: number;
  knowledge_base_fights: number;
  wars_recorded: number;
}

export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch(`${PROXY}/stats/public`, { headers: jsonHeaders });
    if (!res.ok) return null;
    return (await res.json()) as PublicStats;
  } catch {
    return null;
  }
}
