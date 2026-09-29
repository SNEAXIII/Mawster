'use client'

import { useRef, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { useRequiredSession } from '@/hooks/use-required-session'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { LayoutTemplate, Map as MapIcon, Shield } from 'lucide-react'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'
import { DefenseActionsProvider } from '@/app/contexts/defense-actions-context'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import { downloadElementAsPng } from '@/app/lib/export-image'
import DefenseHeader from './defense-header'
import PlanWorkspace from './plan-workspace'
import TemplateWorkspace from './template-workspace'
import { useDefenseViewModel } from '../_viewmodels/use-defense-viewmodel'

type DefenseTab = 'plans' | 'templates'

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
  const [tab, setTab] = useState<DefenseTab>('plans')

  const exportDefenseMapRef = useRef<HTMLDivElement>(null)
  const exportDefenseAssignementsRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const selectedAlliance = vm.alliances.find((a) => a.id === vm.selectedAllianceId) ?? null

  const exportImage = async (target: 'map' | 'assignments') => {
    const ref = target === 'map' ? exportDefenseMapRef : exportDefenseAssignementsRef
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

  if (vm.loading || status === 'loading') return <FullPageSpinner />

  if (vm.alliances.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center'>
        <Shield className='size-16 text-muted-foreground mb-4' />
        <p className='text-muted-foreground'>{t.game.defense.noAlliance}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <ExportModeProvider value={exporting}>
        <DefenseActionsProvider value={vm.gridActions}>
          <DefenseHeader
            alliances={vm.alliances}
            selectedAllianceId={vm.selectedAllianceId}
            onAllianceChange={vm.handleAllianceChange}
            selectedBg={vm.selectedBg}
            onBgChange={vm.handleBgChange}
            canManage={vm.userCanPlace}
            format={vm.format}
            onFormatChange={vm.setFormat}
            onExportMapClick={() => exportImage('map')}
            onExportListClick={() => exportImage('assignments')}
            exporting={exporting}
            showBg={!vm.userCanPlace || tab === 'plans'}
          >
            {vm.userCanPlace && (
              <ToggleGroup dataCy='defense-tab-toggle'>
                <ToggleButton
                  active={tab === 'plans'}
                  onClick={() => setTab('plans')}
                  dataCy='defense-tab-plans'
                >
                  <MapIcon className='size-3.5' />
                  {t.game.defense.tabs.plans}
                </ToggleButton>
                <ToggleButton
                  active={tab === 'templates'}
                  onClick={() => setTab('templates')}
                  dataCy='defense-tab-templates'
                >
                  <LayoutTemplate className='size-3.5' />
                  {t.game.defense.tabs.templates}
                </ToggleButton>
              </ToggleGroup>
            )}
          </DefenseHeader>
          {(!vm.userCanPlace || tab === 'plans') && (
            <PlanWorkspace
              vm={vm}
              exportDefenseMapRef={exportDefenseMapRef}
              exportDefenseAssignementsRef={exportDefenseAssignementsRef}
              exporting={exporting}
              selectedAlliance={selectedAlliance}
            />
          )}
          {vm.userCanPlace && tab === 'templates' && (
            <TemplateWorkspace
              allianceId={vm.selectedAllianceId}
              format={vm.format}
              bg={vm.selectedBg}
            />
          )}
        </DefenseActionsProvider>
      </ExportModeProvider>
    </div>
  )
}
