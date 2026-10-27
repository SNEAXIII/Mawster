import { api } from '@/app/services/utils'
import type { AllianceInvitation } from '@/app/services/game'
import type { UpgradeRequest } from '@/app/services/roster'
import type { DefensePlanNode } from '@/app/services/defense'

export interface PlayerDashboardAlliance {
  alliance_id: string
  battlegroup: number | null
}

export interface PlayerDashboardWar {
  war_id: string
  opponent_name: string
  battlegroup: number
  is_ready: boolean
}

export interface PlayerDashboard {
  invitations: AllianceInvitation[]
  upgrade_requests: UpgradeRequest[]
  alliance: PlayerDashboardAlliance | null
  defense: DefensePlanNode[]
  war: PlayerDashboardWar | null
}

export async function getPlayerDashboard(gameAccountId: string): Promise<PlayerDashboard> {
  return api(
    `/me/dashboard?game_account_id=${encodeURIComponent(gameAccountId)}`,
    'Erreur lors de la récupération du tableau de bord'
  )
}
