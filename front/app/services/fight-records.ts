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
  war_id?: string | null;
  alliance_id: string;
  alliance_name: string;
  season_id: string | null;
  game_account_pseudo?: string | null;
  node_number: number;
  tier?: number | null;
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  stars?: number | null;
  rank?: number | null;
  ascension?: number | null;
  is_saga_attacker?: boolean | null;
  defender_champion_id: string;
  defender_champion_name: string;
  defender_champion_class: string;
  defender_image_url: string | null;
  defender_stars?: number | null;
  defender_rank?: number | null;
  defender_ascension?: number | null;
  defender_is_saga_defender?: boolean | null;
  ko_count: number;
  is_planning_error: boolean;
  assisted: boolean;
  synergies: SynergyRecord[];
  prefights: PrefightRecord[];
  is_imported?: boolean;
  created_at?: string | null;
  note?: string | null;
  note_id?: string | null;
  note_blocked?: boolean;
  note_author?: string | null;
}

export interface PaginatedFightRecords {
  items: FightRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Season {
  id: string;
  number: number;
  status: 'upcoming' | 'active' | 'ended';
}

export type FightRecordSource = 'all' | 'imported' | 'non_imported';

export interface FightRecordFilters {
  champion_id?: string;
  defender_champion_id?: string;
  node_number?: number;
  tier?: number;
  season_selector?: string;
  season_id?: string;
  alliance_id?: string;
  game_account_pseudo?: string;
  planning_error_only?: boolean;
  source?: FightRecordSource;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface AccessibleAlliance {
  id: string;
  name: string;
  tag: string;
}

export async function getAccessibleAlliances(): Promise<AccessibleAlliance[]> {
  const res = await fetch(`${PROXY}/alliances/accessible`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load accessible alliances');
  return res.json();
}

export async function getSeasons(): Promise<Season[]> {
  const res = await fetch(`${PROXY}/seasons`, { headers: jsonHeaders });
  if (!res.ok) throw new Error('Failed to load seasons');
  return res.json();
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

export interface ImportRow {
  champion_id: string;
  defender_champion_id: string;
  node_number: number;
  season_name: string;
  ko_count: number;
}

export interface ImportFightRecordsRequest {
  rows: ImportRow[];
}

export interface ImportFightRecordsResponse {
  imported: number;
  skipped: number;
}

export async function importFightRecords(
  allianceId: string,
  payload: ImportFightRecordsRequest
): Promise<ImportFightRecordsResponse> {
  const response = await fetch(`${PROXY}/alliances/${allianceId}/fight-records/import`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
