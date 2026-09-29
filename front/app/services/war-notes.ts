import { api, jsonBody } from '@/app/services/utils'

// ─── War Fight Note Service ──────────────────────────────

export interface WarFightNote {
  id: string
  war_id: string
  battlegroup: number
  node_number: number
  content: string
  updated_by_pseudo: string | null
  updated_at: string
}

export async function upsertWarFightNote(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number,
  content: string
): Promise<WarFightNote> {
  return api(
    `/alliances/${allianceId}/wars/${warId}/nodes/${battlegroup}/${nodeNumber}/note`,
    'Failed to save war fight note',
    jsonBody('PUT', { content })
  )
}

export async function deleteWarFightNote(
  allianceId: string,
  warId: string,
  battlegroup: number,
  nodeNumber: number
): Promise<void> {
  await api(
    `/alliances/${allianceId}/wars/${warId}/nodes/${battlegroup}/${nodeNumber}/note`,
    'Failed to delete war fight note',
    { method: 'DELETE' }
  )
}
