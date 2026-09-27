'use client'

import { useEffect, useState } from 'react'
import { useAllianceRole } from '@/hooks/use-alliance-role'
import { useAllianceSelector } from '@/hooks/use-alliance-selector'
import { useCurrentSeason } from '@/hooks/use-current-season'
import type { SeasonFormat } from '@/app/services/season'
import { usePlanList } from '../_hooks/use-plan-list'
import { usePlanEditor } from '../_hooks/use-plan-editor'
import { usePlanCommands } from '../_hooks/use-plan-commands'
import { useActivePlan } from '../_hooks/use-active-plan'

interface UseDefenseViewModelOptions {
  onStateChange?: (allianceId: string, bg: number) => void
  initialAllianceId?: string
  initialBg?: number
}

export function useDefenseViewModel({
  onStateChange,
  initialAllianceId,
  initialBg,
}: UseDefenseViewModelOptions = {}) {
  const { canPlace } = useAllianceRole()

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector({ initialAllianceId, initialBg })

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId)
  // Placement rights, not management rights: strategists place, officers and the
  // owner keep everything else.
  const userCanPlace = selectedAlliance ? canPlace(selectedAlliance) : false

  const currentSeason = useCurrentSeason()
  const [formatChoice, setFormatChoice] = useState<SeasonFormat | null>(null)
  const format: SeasonFormat = formatChoice ?? currentSeason?.format ?? 'regular'

  const planList = usePlanList(selectedAllianceId, selectedBg, format, userCanPlace)
  const selectedPlan = planList.plans.find((p) => p.id === planList.selectedPlanId) ?? null
  const defenseActions = usePlanEditor(selectedAllianceId, planList.selectedPlanId, () =>
    planList.refreshPlans()
  )
  const planCommands = usePlanCommands({
    allianceId: selectedAllianceId,
    bg: selectedBg,
    selected: selectedPlan,
    onChanged: (planId) => planList.refreshPlans(planId),
  })
  const activeView = useActivePlan(selectedAllianceId, selectedBg, !userCanPlace)
  const gridActions = userCanPlace ? defenseActions : activeView
  const gridFormat = userCanPlace ? format : activeView.activeFormat

  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      const firstId = alliances[0].id
      setSelectedAllianceId(firstId)
      onStateChange?.(firstId, selectedBg)
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [alliances])

  const handleNodeClick = (nodeNumber: number) => {
    if (!userCanPlace) return
    defenseActions.setSelectorNode(nodeNumber)
  }

  const handleBgChange = (bg: number) => {
    setSelectedBg(bg)
    if (selectedAllianceId) onStateChange?.(selectedAllianceId, bg)
  }

  const handleAllianceChange = (allianceId: string) => {
    setSelectedAllianceId(allianceId)
    setSelectedBg(1)
    onStateChange?.(allianceId, 1)
  }

  return {
    alliances,
    selectedAllianceId,
    selectedBg,
    loading,
    userCanPlace,
    format,
    setFormat: setFormatChoice,
    planList,
    selectedPlan,
    planCommands,
    defenseActions,
    gridActions,
    gridFormat,
    handleNodeClick,
    handleBgChange,
    handleAllianceChange,
  }
}
