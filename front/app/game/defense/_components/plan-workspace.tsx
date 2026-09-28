'use client'

import type { RefObject } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
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
            onSelect={vm.planList.setSelectedPlanId}
            commands={vm.planCommands}
          />
          {defenseActions.placements.length > 0 && (
            <Button
              variant='destructive'
              size='sm'
              data-cy='defense-clear-all'
              onClick={() => defenseActions.setClearConfirmOpen(true)}
            >
              <FiTrash2 className='w-4 h-4 mr-1' />
              {t.game.defense.clearAll}
            </Button>
          )}
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
      {vm.userCanPlace && vm.planList.listLoaded && vm.planList.selectedPlanId === null ? (
        <p
          className='text-sm text-muted-foreground'
          data-cy='defense-no-plan'
        >
          {t.game.defense.plans.createFirst}
        </p>
      ) : (
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
