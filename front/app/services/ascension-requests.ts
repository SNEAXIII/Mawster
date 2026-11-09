import { api, jsonBody } from '@/app/services/utils'

export const getRequestedChampionIds = (): Promise<string[]> =>
  api('/ascension-requests/champion-ids', 'Erreur lors de la récupération des demandes')

export const createAscensionRequest = (championId: string): Promise<void> =>
  api(
    '/ascension-requests',
    "Erreur lors de la demande d'ascension",
    jsonBody('POST', { champion_id: championId })
  )

export interface AdminAscensionRequest {
  id: string
  champion_name: string
  image_url: string | null
  requester_login: string
}

export const getAdminAscensionRequests = (): Promise<AdminAscensionRequest[]> =>
  api('/admin/ascension-requests', 'Erreur lors de la récupération des demandes')

export const acceptAscensionRequest = (id: string): Promise<void> =>
  api(
    `/admin/ascension-requests/${id}/accept`,
    "Erreur lors de l'acceptation de la demande",
    jsonBody('POST')
  )

export const refuseAscensionRequest = (id: string): Promise<void> =>
  api(`/admin/ascension-requests/${id}`, 'Erreur lors du refus de la demande', jsonBody('DELETE'))
