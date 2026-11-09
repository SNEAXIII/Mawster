import { api, jsonBody } from '@/app/services/utils'

export const getRequestedChampionIds = (): Promise<string[]> =>
  api('/ascension-requests/champion-ids', 'Erreur lors de la récupération des demandes')

export const createAscensionRequest = (championId: string): Promise<void> =>
  api(
    '/ascension-requests',
    "Erreur lors de la demande d'ascension",
    jsonBody('POST', { champion_id: championId })
  )
