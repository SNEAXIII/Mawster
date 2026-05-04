const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export interface AllianceSnapshotStat {
  alliance_id: string;
  alliance_name: string;
  war_count: number;
}

export interface ForceSnapshotResult {
  snapshotted: number;
  skipped: number;
}

export interface SynergyRecord {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  stars: number;
  ascension: number;
}

export interface PrefightRecord {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  stars: number;
  ascension: number;
}

export interface FightRecord {
  id: string;
  war_id: string;
  alliance_id: string;
  alliance_name: string;
  season_id: string | null;
  game_account_pseudo: string;
  node_number: number;
  tier: number;
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  stars: number;
  rank: number;
  ascension: number;
  is_saga_attacker: boolean;
  defender_champion_id: string;
  defender_champion_name: string;
  defender_champion_class: string;
  defender_image_url: string | null;
  defender_stars: number;
  defender_rank: number;
  defender_ascension: number;
  defender_is_saga_defender: boolean;
  ko_count: number;
  synergies: SynergyRecord[];
  prefights: PrefightRecord[];
  created_at: string;
}

export interface PaginatedFightRecords {
  items: FightRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface FightRecordFilters {
  champion_id?: string;
  defender_champion_id?: string;
  node_number?: number;
  tier?: number;
  season_id?: string;
  alliance_id?: string;
  game_account_pseudo?: string;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function getSnapshotStats(): Promise<AllianceSnapshotStat[]> {
  const res = await fetch(`${PROXY}/admin/wars/snapshot-stats`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load snapshot stats');
  return res.json();
}

export async function forceSnapshotWars(): Promise<ForceSnapshotResult> {
  const res = await fetch(`${PROXY}/admin/wars/force-snapshot`, {
    method: 'POST',
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to force snapshot');
  return res.json();
}

export async function getFightRecords(filters?: FightRecordFilters): Promise<PaginatedFightRecords> {
  const qs = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value));
      }
    }
  }
  const query = qs.toString();
  const params = query ? `?${query}` : '';
  const res = await fetch(`${PROXY}/fight-records${params}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error('Failed to load fight records');
  return res.json();
}
