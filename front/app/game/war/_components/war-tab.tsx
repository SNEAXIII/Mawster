'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/app/lib/utils'
import { useI18n } from '@/app/i18n'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { WarMode } from './war-types'
import { useWar } from '@/app/contexts/war-context'
import { useCurrentSeason } from '@/hooks/use-current-season'
import WarOverview from './war-overview'
import WarAttackFrame from './war-attack-frame'
import ExportHeader from '@/app/game/_components/export-header'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import { downloadElementAsPng } from '@/app/lib/export-image'

export type fightStateFilter = 'all' | 'done' | 'todo'

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
})

const WarAttackerPanel = dynamic(() => import('./war-attacker-panel'), {
  loading: () => <FullPageSpinner />,
})

export default function WarTab({ onEditClick }: Readonly<{ onEditClick: () => void }>) {
  const { t } = useI18n()
  const {
    currentWar,
    selectedBg,
    canPlaceWar,
    isWarClosed,
    warMode,
    setWarMode,
    warLoading,
    placements,
    prefights,
    handleNodeClick,
    handleRemoveDefender,
    alliances,
    selectedAllianceId,
  } = useWar()

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId) ?? null
  const currentSeason = useCurrentSeason()

  const [playerFilter, setPlayerFilter] = useState('')
  const [combatFilter, setCombatFilter] = useState<fightStateFilter>('todo')
  const effectiveFilter: fightStateFilter = isWarClosed ? 'all' : combatFilter
  const [exporting, setExporting] = useState(false)

  const exportMapRef = useRef<HTMLDivElement>(null)
  const exportAttackersRef = useRef<HTMLDivElement>(null)

  const exportImage = async (target: 'map' | 'attackers') => {
    const ref = target === 'map' ? exportMapRef : exportAttackersRef
    if (!exportMapRef.current || !exportAttackersRef.current) return
    const previousMode = warMode
    setWarMode(WarMode.Export)
    setExporting(true)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    try {
      if (!ref.current) return
      const allianceName = selectedAlliance?.name ?? 'alliance'
      const date = new Date().toISOString().split('T')[0]
      await downloadElementAsPng(
        ref.current,
        `war-${target}-bg${selectedBg}-${allianceName}-${date}.png`
      )
    } finally {
      setExporting(false)
      setWarMode(previousMode)
    }
  }

  const handleExportMap = () => exportImage('map')
  const handleExportList = () => exportImage('attackers')

  useEffect(() => {
    setPlayerFilter('')
    setCombatFilter('todo')
  }, [selectedBg])

  const prefightNodes = new Set(prefights.map((pf) => pf.target_node_number))
  const noteNodes = new Set(placements.filter((p) => p.note).map((p) => p.node_number))

  const dimmedNodes = (() => {
    const dimmed = new Set<number>()
    for (const p of placements) {
      let shouldDim = false
      if (playerFilter) {
        const isMyAttacker = p.attacker_pseudo === playerFilter
        const isMyPrefight = prefights.some(
          (pf) => pf.target_node_number === p.node_number && pf.game_pseudo === playerFilter
        )
        if (!isMyAttacker && !isMyPrefight) shouldDim = true
      }
      if (!shouldDim && effectiveFilter !== 'all' && p.attacker_champion_user_id) {
        if (effectiveFilter === 'todo' && p.is_combat_completed) shouldDim = true
        if (effectiveFilter === 'done' && !p.is_combat_completed) shouldDim = true
      }
      if (shouldDim) dimmed.add(p.node_number)
    }
    return dimmed.size > 0 ? dimmed : undefined
  })()

  return (
    <ExportModeProvider value={exporting}>
      <div className='flex flex-col gap-4'>
        <WarOverview
          onEditClick={onEditClick}
          onExportMap={handleExportMap}
          onExportList={handleExportList}
          exporting={exporting}
        />

        {warLoading ? (
          <FullPageSpinner />
        ) : (
          <div className='flex flex-col-reverse lg:flex-row gap-4'>
            <WarAttackFrame>
              <div
                ref={exportMapRef}
                className={cn('p-2 sm:p-3 w-max mx-auto', exporting && 'bg-black')}
              >
                {exporting && selectedAlliance && (
                  <ExportHeader
                    allianceTag={selectedAlliance.tag}
                    allianceName={selectedAlliance.name}
                    modeLabel={t.game.war.modeAttackers}
                    bg={selectedBg}
                    opponentName={currentWar?.opponent_name}
                  />
                )}
                <WarDefenseMap
                  placements={placements}
                  onNodeClick={handleNodeClick}
                  onRemove={handleRemoveDefender}
                  canManage={canPlaceWar && warMode === WarMode.Defenders && !exporting}
                  dimmedNodes={exporting ? undefined : dimmedNodes}
                  prefightNodes={prefightNodes}
                  noteNodes={noteNodes}
                  format={currentWar?.format ?? currentSeason?.format ?? 'regular'}
                />
              </div>
            </WarAttackFrame>
            <div
              className={cn(
                exporting
                  ? 'w-full'
                  : 'w-full lg:w-92 lg:shrink-0 lg:self-start lg:sticky lg:top-0 lg:max-h-[calc(100vh-2rem)]',
                'flex flex-col'
              )}
            >
              <WarAttackerPanel
                playerFilter={playerFilter}
                onPlayerChange={setPlayerFilter}
                combatFilter={effectiveFilter}
                onCombatFilterChange={setCombatFilter}
                exporting={exporting}
                exportRef={exportAttackersRef}
                nodeCount={currentWar?.node_count ?? currentSeason?.node_count ?? 50}
                maxAttackers={
                  currentWar?.max_attackers_per_member ??
                  currentSeason?.max_attackers_per_member ??
                  3
                }
                format={currentWar?.format ?? currentSeason?.format ?? 'regular'}
              />
            </div>
          </div>
        )}
      </div>
    </ExportModeProvider>
  )
}
