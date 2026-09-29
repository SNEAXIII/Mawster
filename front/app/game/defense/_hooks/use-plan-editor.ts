'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import {
  clearPlan,
  getPlan,
  getPlanAvailableChampions,
  getPlanMembers,
  removePlanNode,
  setPlanNode,
  type AvailableChampion,
  type BgMember,
  type DefensePlan,
} from '@/app/services/defense'
import { planNodeToPlacement } from '../_components/plan-node-adapter'
import { usePolledFetch } from './use-polled-fetch'
import { withToast } from '@/app/lib/with-toast'

export function usePlanEditor(
  allianceId: string,
  planId: string | null,
  onPlanChanged: () => void
) {
  const { t } = useI18n()
  const [plan, setPlan] = useState<DefensePlan | null>(null)
  const [bgMembers, setBgMembers] = useState<BgMember[]>([])
  const [availableChampions, setAvailableChampions] = useState<AvailableChampion[]>([])
  const [selectorNode, setSelectorNode] = useState<number | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const loadPlan = useCallback(
    async (_silent: boolean, isStale: () => boolean) => {
      if (!planId) return
      const [loaded, members] = await Promise.all([
        getPlan(allianceId, planId),
        getPlanMembers(allianceId, planId),
      ])
      if (isStale()) return
      setPlan(loaded)
      setBgMembers(members)
    },
    [allianceId, planId]
  )

  const resetPlan = useCallback(() => setPlan(null), [])

  const {
    loading: defenseLoading,
    refresh: refreshPlan,
    resetPollTimer,
  } = usePolledFetch(loadPlan, Boolean(allianceId && planId), Boolean(planId), resetPlan)

  useEffect(() => {
    if (selectorNode === null || !planId) return
    getPlanAvailableChampions(allianceId, planId, selectorNode)
      .then(setAvailableChampions)
      .catch(() => toast.error(t.game.defense.loadError))
  }, [allianceId, planId, selectorNode, t])

  const write = (action: () => Promise<unknown>, success: string, error: string) =>
    withToast(
      async () => {
        await action()
        await refreshPlan(true)
        resetPollTimer()
        onPlanChanged()
      },
      { success, error }
    )

  const handlePlaceDefender = async (
    championUserId: string,
    _gameAccountId: string,
    name: string
  ) => {
    if (!planId || selectorNode === null) return
    await write(
      () => setPlanNode(allianceId, planId, selectorNode, championUserId),
      t.game.defense.placeSuccess.replace('{name}', name).replace('{node}', String(selectorNode)),
      t.game.defense.placeError
    )
  }

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!planId) return
    await write(
      () => removePlanNode(allianceId, planId, nodeNumber),
      t.game.defense.removeSuccess,
      t.game.defense.removeError
    )
  }

  const handleClearDefense = async () => {
    if (!planId) return
    await write(
      () => clearPlan(allianceId, planId),
      t.game.defense.clearSuccess,
      t.game.defense.clearError
    )
    setClearConfirmOpen(false)
  }

  const placements = (plan?.nodes ?? []).map((n) => planNodeToPlacement(n, allianceId))

  return {
    plan,
    placements,
    availableChampions,
    bgMembers,
    defenseLoading,
    selectorNode,
    setSelectorNode,
    clearConfirmOpen,
    setClearConfirmOpen,
    handlePlaceDefender,
    handleRemoveDefender,
    handleClearDefense,
    refreshPlan,
  }
}
