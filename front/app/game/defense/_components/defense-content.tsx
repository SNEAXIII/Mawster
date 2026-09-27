'use client'

import { useRef, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { useRequiredSession } from '@/hooks/use-required-session'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import { FiTrash2 } from 'react-icons/fi'
import { DefenseActionsProvider } from '@/app/contexts/defense-actions-context'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import { downloadElementAsPng } from '@/app/lib/export-image'
import DefenseHeader from './defense-header'
import DefenseGrid from './defense-grid'
import PlanToolbar from './plan-toolbar'
import { useDefenseViewModel } from '../_viewmodels/use-defense-viewmodel'

interface DefensePageContentProps {
  onStateChange?: (allianceId: string, bg: number) => void
  initialAllianceId?: string
  initialBg?: number
}

export default function DefensePageContent({
  onStateChange,
  initialAllianceId,
  initialBg,
}: Readonly<DefensePageContentProps> = {}) {
  const { t } = useI18n()
  const { status } = useRequiredSession()

  const vm = useDefenseViewModel({ onStateChange, initialAllianceId, initialBg })

  const exportDefenseMapRef = useRef<HTMLDivElement>(null)
  const exportDefenseAssignementsRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const selectedAlliance = vm.alliances.find((a) => a.id === vm.selectedAllianceId) ?? null

  const exportImage = async (target: 'map' | 'assignments') => {
    const ref = target === 'map' ? exportDefenseMapRef : exportDefenseAssignementsRef
    if (!exportDefenseMapRef.current || !exportDefenseAssignementsRef.current) return
    setExporting(true)
    // Wait for React to commit the state change (bg-black, hidden remove buttons,
    // full-resolution champion images) to the DOM
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    try {
      if (!ref.current) return
      const allianceName = selectedAlliance?.name ?? 'alliance'
      const date = new Date().toISOString().split('T')[0]
      await downloadElementAsPng(
        ref.current,
        `defense-${target}-bg${vm.selectedBg}-${allianceName}-${date}.png`
      )
    } finally {
      setExporting(false)
    }
  }

  const handleExportMap = () => exportImage('map')
  const handleExportList = () => exportImage('assignments')

  if (vm.loading || status === 'loading') return <FullPageSpinner />

  if (vm.alliances.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center'>
        <Shield className='size-16 text-muted-foreground mb-4' />
        <p className='text-muted-foreground'>{t.game.defense.noAlliance}</p>
      </div>
    )
  }

  const { defenseActions } = vm

  return (
    <div className='flex flex-col gap-4'>
      <ExportModeProvider value={exporting}>
        <DefenseActionsProvider value={defenseActions}>
          <DefenseHeader
            alliances={vm.alliances}
            selectedAllianceId={vm.selectedAllianceId}
            onAllianceChange={vm.handleAllianceChange}
            selectedBg={vm.selectedBg}
            onBgChange={vm.handleBgChange}
            canManage={vm.userCanPlace}
            format={vm.format}
            onFormatChange={vm.setFormat}
            onExportMapClick={handleExportMap}
            onExportListClick={handleExportList}
            exporting={exporting}
          />
          {vm.userCanPlace && (
            <>
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
              <DefenseGrid
                onNodeClick={vm.handleNodeClick}
                canManage={vm.userCanPlace}
                exportDefenseMapRef={exportDefenseMapRef}
                exportDefenseAssignementsRef={exportDefenseAssignementsRef}
                exporting={exporting}
                selectedAllianceTag={selectedAlliance?.tag}
                selectedAllianceName={selectedAlliance?.name}
                selectedBg={vm.selectedBg}
                format={vm.format}
              />
            </>
          )}
        </DefenseActionsProvider>
      </ExportModeProvider>
    </div>
  )
}
