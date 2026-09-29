import { api, jsonBody } from '@/app/services/utils'

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
  return api(
    `/game-accounts/${gameAccountId}/masteries`,
    'Erreur lors de la récupération des maîtrises'
  )
}

export async function saveMasteries(
  gameAccountId: string,
  items: MasteryUpsertItem[]
): Promise<MasteryEntry[]> {
  return api(
    `/game-accounts/${gameAccountId}/masteries`,
    'Erreur lors de la sauvegarde des maîtrises',
    jsonBody('PUT', items)
  )
}
