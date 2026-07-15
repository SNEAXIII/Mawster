'use client'

import React, { useEffect } from 'react'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import type { Alliance } from '@/app/services/game'

export interface AllianceRoleAPI {
  myAccountIds: Set<string>
  isMine: (gameAccountId: string) => boolean
  isOwner: (alliance: Alliance) => boolean
  canManage: (alliance: Alliance) => boolean
  getRoleFor: (
    allianceId: string
  ) => ReturnType<ReturnType<typeof useAllianceContext>['getRoleFor']>
  loading: boolean
  refresh: () => Promise<void>
}

export function AllianceRoleProvider({
  children,
  refreshKey = 0,
}: {
  children: React.ReactNode
  refreshKey?: number
}) {
  const { refreshRoles } = useAllianceContext()

  useEffect(() => {
    if (refreshKey > 0) refreshRoles()
  }, [refreshKey, refreshRoles])

  return React.createElement(React.Fragment, null, children)
}

export function useAllianceRole(): AllianceRoleAPI {
  const ctx = useAllianceContext()
  return {
    myAccountIds: ctx.myAccountIds,
    isMine: ctx.isMine,
    isOwner: ctx.isOwner,
    canManage: ctx.canManage,
    getRoleFor: ctx.getRoleFor,
    loading: ctx.rolesLoading,
    refresh: ctx.refreshRoles,
  }
}
