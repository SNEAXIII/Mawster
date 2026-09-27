'use client'

import { useCallback, useState } from 'react'
import { getActivePlan, getBgMembers, type ActivePlan, type BgMember } from '@/app/services/defense'
import { planNodeToPlacement } from '../_components/plan-node-adapter'
import { usePolledFetch } from './use-polled-fetch'

const noop = async () => {}

/** Read-only counterpart of usePlanEditor for members without placement rights:
 *  same return shape so DefenseGrid renders unchanged, but writes are no-ops. */
export function useActivePlan(allianceId: string, bg: number, enabled: boolean) {
  const [active, setActive] = useState<ActivePlan | null>(null)
  const [bgMembers, setBgMembers] = useState<BgMember[]>([])

  const loadActive = useCallback(async () => {
    if (!allianceId) return
    const [loaded, members] = await Promise.all([
      getActivePlan(allianceId, bg),
      getBgMembers(allianceId, bg),
    ])
    setActive(loaded)
    setBgMembers(members)
  }, [allianceId, bg])

  const { loading: defenseLoading, refresh } = usePolledFetch(
    loadActive,
    enabled && Boolean(allianceId),
    enabled && Boolean(allianceId)
  )

  return {
    plan: active?.plan ?? null,
    activeFormat: active?.format ?? 'regular',
    placements: (active?.plan?.nodes ?? []).map((n) => planNodeToPlacement(n, allianceId)),
    availableChampions: [],
    bgMembers,
    defenseLoading,
    selectorNode: null as number | null,
    setSelectorNode: (_node: number | null) => {},
    clearConfirmOpen: false,
    setClearConfirmOpen: (_open: boolean) => {},
    handlePlaceDefender: noop,
    handleRemoveDefender: noop,
    handleClearDefense: noop,
    refreshPlan: refresh,
  }
}
