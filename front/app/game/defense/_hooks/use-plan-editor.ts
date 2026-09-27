'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useVisiblePoll } from '@/hooks/use-visible-poll'
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

export function usePlanEditor(
  allianceId: string,
  planId: string | null,
  onPlanChanged: () => void
) {
  const { t } = useI18n()
  const [plan, setPlan] = useState<DefensePlan | null>(null)
  const [bgMembers, setBgMembers] = useState<BgMember[]>([])
  const [availableChampions, setAvailableChampions] = useState<AvailableChampion[]>([])
  const [defenseLoading, setDefenseLoading] = useState(false)
  const [selectorNode, setSelectorNode] = useState<number | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const refreshPlan = useCallback(
    async (silent = false) => {
      if (!allianceId || !planId) {
        setPlan(null)
        return
      }
      if (!silent) setDefenseLoading(true)
      try {
        const [loaded, members] = await Promise.all([
          getPlan(allianceId, planId),
          getPlanMembers(allianceId, planId),
        ])
        setPlan(loaded)
        setBgMembers(members)
      } catch {
        if (!silent) toast.error(t.game.defense.loadError)
      } finally {
        if (!silent) setDefenseLoading(false)
      }
    },
    [allianceId, planId, t]
  )

  const refreshRef = useRef(refreshPlan)
  useEffect(() => {
    refreshRef.current = refreshPlan
  }, [refreshPlan])
  const resetPollTimer = useVisiblePoll(() => refreshRef.current(true), 10_000, Boolean(planId))

  useEffect(() => {
    refreshPlan()
    resetPollTimer()
    // oxlint-disable-next-line react/exhaustive-deps -- resetPollTimer is stable
  }, [refreshPlan])

  useEffect(() => {
    if (selectorNode === null || !planId) return
    getPlanAvailableChampions(allianceId, planId, selectorNode)
      .then(setAvailableChampions)
      .catch(() => toast.error(t.game.defense.loadError))
  }, [allianceId, planId, selectorNode, t])

  const afterWrite = async (message: string) => {
    toast.success(message)
    await refreshPlan(true)
    resetPollTimer()
    onPlanChanged()
  }

  const handlePlaceDefender = async (
    championUserId: string,
    _gameAccountId: string,
    name: string
  ) => {
    if (!planId || selectorNode === null) return
    try {
      await setPlanNode(allianceId, planId, selectorNode, championUserId)
      await afterWrite(
        t.game.defense.placeSuccess.replace('{name}', name).replace('{node}', String(selectorNode))
      )
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.placeError)
    }
  }

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!planId) return
    try {
      await removePlanNode(allianceId, planId, nodeNumber)
      await afterWrite(t.game.defense.removeSuccess)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.removeError)
    }
  }

  const handleClearDefense = async () => {
    if (!planId) return
    try {
      await clearPlan(allianceId, planId)
      await afterWrite(t.game.defense.clearSuccess)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.defense.clearError)
    }
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
