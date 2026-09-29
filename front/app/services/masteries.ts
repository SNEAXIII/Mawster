import { PROXY, jsonHeaders } from '@/app/services/utils'

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data = await response.json().catch(() => ({}))
  const msg = (data as { detail?: string }).detail ?? fallback
  const err = new Error(`Erreur ${response.status}: ${msg}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

export interface MasteryEntry {
  id: string
  mastery_id: string
  mastery_name: string
  mastery_max_value: number
  mastery_order: number
  unlocked: number
  attack: number
  defense: number
}

export interface MasteryUpsertItem {
  mastery_id: string
  unlocked: number
  attack: number
  defense: number
}

export async function getMasteries(gameAccountId: string): Promise<MasteryEntry[]> {
  const response = await fetch(`${PROXY}/game-accounts/${gameAccountId}/masteries`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des maîtrises')
  return response.json()
}

export async function saveMasteries(
  gameAccountId: string,
  items: MasteryUpsertItem[]
): Promise<MasteryEntry[]> {
  const response = await fetch(`${PROXY}/game-accounts/${gameAccountId}/masteries`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(items),
  })
  await throwOnError(response, 'Erreur lors de la sauvegarde des maîtrises')
  return response.json()
}
