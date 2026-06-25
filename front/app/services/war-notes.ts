// ─── War Fight Note Service ──────────────────────────────

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
  (err as Error & { status: number }).status = response.status;
  throw err;
}

export interface WarFightNote {
  id: string;
  war_id: string;
  battlegroup: number;
  node_number: number;
  content: string;
  updated_by_pseudo: string | null;
  updated_at: string;
}

export async function upsertWarFightNote(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  content: string
): Promise<WarFightNote> {
  const response = await fetch(
    `${PROXY}/alliances/${allianceId}/wars/${warId}/nodes/${battlegroup}/${nodeNumber}/note`,
    {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ content }),
    }
  );
  await throwOnError(response, 'Failed to save war fight note');
  return response.json();
}
