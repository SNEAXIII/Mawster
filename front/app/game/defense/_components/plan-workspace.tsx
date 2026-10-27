'use client'

import type { RefObject } from 'react'
import { FiUserMinus } from 'react-icons/fi'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { FullPageSpinner } from '@/components/full-page-spinner'
import type { AllianceWithVisitorFlag } from '@/app/services/game'
import DefenseGrid from './defense-grid'
import PlanToolbar from './plan-toolbar'
import type { useDefenseViewModel } from '../_viewmodels/use-defense-viewmodel'

interface PlanWorkspaceProps {
  vm: ReturnType<typeof useDefenseViewModel>
  exportDefenseMapRef: RefObject<HTMLDivElement | null>
  exportDefenseAssignementsRef: RefObject<HTMLDivElement | null>
  exporting: boolean
  selectedAlliance: AllianceWithVisitorFlag | null
}

export default function PlanWorkspace({
  vm,
  exportDefenseMapRef,
  exportDefenseAssignementsRef,
  exporting,
  selectedAlliance,
}: Readonly<PlanWorkspaceProps>) {
  const { t } = useI18n()
  const { defenseActions } = vm
  const plan = defenseActions.plan
  const progress =
    plan && plan.id === vm.selectedPlan?.id
      ? { assigned: plan.nodes.filter((n) => n.champion_user_id).length, total: plan.node_count }
      : undefined
  const waitingForList = vm.userCanPlace && !vm.planList.listLoaded
  const noPlan = vm.userCanPlace && vm.planList.listLoaded && vm.planList.selectedPlanId === null
  const noActivePlan =
    vm.userCanPlace && vm.planList.plans.length > 0 && !vm.planList.plans.some((p) => p.is_active)

  return (
    <>
      {vm.userCanPlace && (
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <PlanToolbar
            allianceId={vm.selectedAllianceId}
            format={vm.format}
            plans={vm.planList.plans}
            quota={vm.planList.quota}
            selected={vm.selectedPlan}
            progress={progress}
            onSelect={vm.planList.setSelectedPlanId}
            commands={vm.planCommands}
          />
          {defenseActions.placements.length > 0 && (
            <Button
              variant='outline'
              size='sm'
              data-cy='defense-clear-all'
              onClick={() => defenseActions.setClearConfirmOpen(true)}
            >
              <FiUserMinus className='w-4 h-4 mr-1' />
              {t.game.defense.clearAll}
            </Button>
          )}
        </div>
      )}
      {noActivePlan && (
        <div
          className='flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500'
          data-cy='defense-no-active-plan-warning'
        >
          <AlertTriangle className='h-4 w-4 shrink-0' />
          {t.game.defense.plans.noActiveManager}
        </div>
      )}
      {!vm.userCanPlace && vm.gridActions.plan === null && (
        <p
          className='text-sm text-muted-foreground'
          data-cy='defense-no-active-plan'
        >
          {t.game.defense.plans.noActive}
        </p>
      )}
      {waitingForList && <FullPageSpinner />}
      {noPlan && (
        <p
          className='text-sm text-muted-foreground'
          data-cy='defense-no-plan'
        >
          {t.game.defense.plans.createFirst}
        </p>
      )}
      {!waitingForList && !noPlan && (
        <DefenseGrid
          onNodeClick={vm.handleNodeClick}
          canManage={vm.userCanPlace}
          exportDefenseMapRef={exportDefenseMapRef}
          exportDefenseAssignementsRef={exportDefenseAssignementsRef}
          exporting={exporting}
          selectedAllianceTag={selectedAlliance?.tag}
          selectedAllianceName={selectedAlliance?.name}
          selectedBg={vm.selectedBg}
          format={vm.gridFormat}
        />
      )}
    </>
  )
}
