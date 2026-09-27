'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useVisiblePoll } from '@/hooks/use-visible-poll'
import { getActivePlan, getBgMembers, type ActivePlan, type BgMember } from '@/app/services/defense'
import { planNodeToPlacement } from '../_components/plan-node-adapter'

const noop = async () => {}

/** Read-only counterpart of usePlanEditor for members without placement rights:
 *  same return shape so DefenseGrid renders unchanged, but writes are no-ops. */
export function useActivePlan(allianceId: string, bg: number, enabled: boolean) {
  const { t } = useI18n()
  const [active, setActive] = useState<ActivePlan | null>(null)
  const [bgMembers, setBgMembers] = useState<BgMember[]>([])
  const [defenseLoading, setDefenseLoading] = useState(false)

  const refresh = useCallback(
    async (silent = false) => {
      if (!allianceId || !enabled) return
      if (!silent) setDefenseLoading(true)
      try {
        const [loaded, members] = await Promise.all([
          getActivePlan(allianceId, bg),
          getBgMembers(allianceId, bg),
        ])
        setActive(loaded)
        setBgMembers(members)
      } catch {
        if (!silent) toast.error(t.game.defense.loadError)
      } finally {
        if (!silent) setDefenseLoading(false)
      }
    },
    [allianceId, bg, enabled, t]
  )

  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])
  useVisiblePoll(() => refreshRef.current(true), 10_000, enabled && Boolean(allianceId))
  useEffect(() => {
    refresh()
  }, [refresh])

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
