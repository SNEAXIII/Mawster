'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { listPlans, type DefensePlanSummary, type Quota } from '@/app/services/defense'
import type { SeasonFormat } from '@/app/services/season'

export function usePlanList(
  allianceId: string,
  bg: number,
  format: SeasonFormat,
  enabled: boolean
) {
  const { t } = useI18n()
  const [plans, setPlans] = useState<DefensePlanSummary[]>([])
  const [quota, setQuota] = useState<Quota>({ used: 0, limit: 10 })
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [listLoaded, setListLoaded] = useState(false)
  const requestIdRef = useRef(0)

  const refreshPlans = useCallback(
    async (preferId?: string) => {
      if (!allianceId || !enabled) return
      const requestId = ++requestIdRef.current
      try {
        const list = await listPlans(allianceId, bg, format)
        if (requestId !== requestIdRef.current) return
        setPlans(list.plans)
        setQuota(list.quota)
        setSelectedPlanId((current) => {
          const wanted = preferId ?? current
          if (wanted && list.plans.some((p) => p.id === wanted)) return wanted
          return (list.plans.find((p) => p.is_active) ?? list.plans[0])?.id ?? null
        })
        setListLoaded(true)
      } catch {
        if (requestId === requestIdRef.current) toast.error(t.game.defense.loadError)
      }
    },
    [allianceId, bg, format, enabled, t]
  )

  useEffect(() => {
    setSelectedPlanId(null)
    setListLoaded(false)
    void refreshPlans()
  }, [refreshPlans])

  return { plans, quota, selectedPlanId, setSelectedPlanId, refreshPlans, listLoaded }
}
