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
