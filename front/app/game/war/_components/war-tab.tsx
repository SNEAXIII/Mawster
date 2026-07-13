'use client'

import dynamic from 'next/dynamic'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { snapdom } from '@zumer/snapdom'
import { Button } from '@/components/ui/button'
import { Shield, Swords, Trash2, Pencil, Camera, Link2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { useI18n } from '@/app/i18n'
import { toast } from 'sonner'
import { FullPageSpinner } from '@/components/full-page-spinner'
import ChampionPortrait from '@/components/champion-portrait'
import { WarMode } from './war-types'
import { useWar } from '@/app/contexts/war-context'
import { useCurrentSeason } from '@/hooks/use-current-season'
import SeasonBanner from './season-banner'
import ExportHeader from '@/app/game/_components/export-header'

type ToggleButtonProps = {
  active: boolean
  onClick: () => void
  dataCy?: string
  children: ReactNode
}

export type fightStateFilter = 'all' | 'done' | 'todo'

function ToggleButton({ active, onClick, dataCy, children }: Readonly<ToggleButtonProps>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
      )}
      data-cy={dataCy}
    >
      {children}
    </button>
  )
}

const WarDefenseMap = dynamic(() => import('./war-defense-map'), {
  loading: () => <FullPageSpinner />,
})

const WarAttackerPanel = dynamic(() => import('./war-attacker-panel'), {
  loading: () => <FullPageSpinner />,
})

export default function WarTab({ onEditClick }: { onEditClick: () => void }) {
  const { t } = useI18n()
  const {
    currentWar,
    selectedBg,
    handleBgChange,
    canManageWar,
    warMode,
    setWarMode,
    warLoading,
    placements,
    prefights,
    handleNodeClick,
    handleRemoveDefender,
    setShowClearConfirm,
    setShowEndConfirm,
    alliances,
    selectedAllianceId,
  } = useWar()

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId) ?? null
  const currentSeason = useCurrentSeason()

  const [playerFilter, setPlayerFilter] = useState('')
  const [combatFilter, setCombatFilter] = useState<fightStateFilter>('todo')
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
      const png = await snapdom.toPng(ref.current, { scale: 1, embedFonts: true })
      const allianceName = selectedAlliance?.name ?? 'alliance'
      const date = new Date().toISOString().split('T')[0]
      const link = document.createElement('a')
      link.download = `war-${target}-bg${selectedBg}-${allianceName}-${date}.png`
      link.href = png.src
      link.click()
    } finally {
      setExporting(false)
      setWarMode(previousMode)
    }
  }

  const handleExportMap = () => exportImage('map')
  const handleExportList = () => exportImage('attackers')

  const handleCopyShareLink = async () => {
    const url = `${window.location.origin}/game/war?alliance=${selectedAllianceId}&bg=${selectedBg}`
    await navigator.clipboard.writeText(url)
    toast.success(t.game.war.shareLinkCopied)
  }

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
      if (!shouldDim && combatFilter !== 'all' && p.attacker_champion_user_id) {
        if (combatFilter === 'todo' && p.is_combat_completed) shouldDim = true
        if (combatFilter === 'done' && !p.is_combat_completed) shouldDim = true
      }
      if (shouldDim) dimmed.add(p.node_number)
    }
    return dimmed.size > 0 ? dimmed : undefined
  })()

  return (
    <div className='flex flex-col gap-4'>
      {/* Controls row: opponent name + BG picker + mode toggle + clear */}
      <div className='flex flex-wrap items-center gap-3'>
        <SeasonBanner season={currentWar ? currentSeason : undefined} />

        {/* ELO badge — read-only, edit from the alliances page */}
        {selectedAlliance && (
          <div
            className='flex items-center gap-1'
            data-cy='war-elo-badge'
          >
            <span className='text-xs font-medium text-muted-foreground'>{t.game.war.elo}:</span>
            <span
              className='text-xs font-bold'
              data-cy='war-elo-value'
            >
              {selectedAlliance.elo}
            </span>
          </div>
        )}

        {/* Tier badge — read-only, edit from the alliances page */}
        {selectedAlliance && (
          <div
            className='flex items-center gap-1'
            data-cy='war-tier-badge'
          >
            <span className='text-xs font-medium text-muted-foreground'>{t.game.war.tier}:</span>
            <span
              className='text-xs font-bold'
              data-cy='war-tier-value'
            >
              {selectedAlliance.tier}
            </span>
          </div>
        )}

        {/* Opponent name */}
        {currentWar && (
          <div className='flex items-center gap-2'>
            <Swords className='size-4 text-muted-foreground' />
            <span
              data-cy='war-opponent-name'
              className='text-sm font-semibold'
            >
              vs {currentWar.opponent_name}
            </span>
          </div>
        )}

        {/* BG button group */}
        <div
          className='flex gap-1 rounded-md border p-1'
          data-cy='bg-picker'
        >
          {[1, 2, 3].map((bg) => (
            <ToggleButton
              key={bg}
              active={selectedBg === bg}
              onClick={() => handleBgChange(bg)}
              dataCy={`bg-btn-${bg}`}
            >
              G{bg}
            </ToggleButton>
          ))}
        </div>

        {/* Mode toggle — visible to officers only */}
        {canManageWar && (
          <div
            className='flex gap-1 rounded-md border p-1'
            data-cy='war-mode-toggle'
          >
            <ToggleButton
              active={warMode === WarMode.Attackers}
              onClick={() => setWarMode(WarMode.Attackers)}
              dataCy='war-mode-attackers'
            >
              <Swords className='size-3.5' />
              {t.game.war.modeAttackers}
            </ToggleButton>
            <ToggleButton
              active={warMode === WarMode.Defenders}
              onClick={() => setWarMode(WarMode.Defenders)}
              dataCy='war-mode-defenders'
            >
              <Shield className='size-3.5' />
              {t.game.war.modeDefenders}
            </ToggleButton>
          </div>
        )}
        {/* Clear BG button */}
        {canManageWar && placements.length > 0 && (
          <Button
            variant='outline'
            onClick={() => setShowClearConfirm(true)}
            data-cy='clear-war-bg-btn'
          >
            <Trash2 className='size-4 mr-2' />
            {t.game.war.clearAll}
          </Button>
        )}
        {/* Share link — always available while a war is active */}
        <Button
          variant='outline'
          onClick={handleCopyShareLink}
          data-cy='share-war-link-btn'
        >
          <Link2 className='w-4 h-4 mr-1' />
          {t.game.war.shareLink}
        </Button>
        {/* Export buttons — one image per click */}
        {placements.length > 0 && (
          <>
            <Button
              variant='outline'
              onClick={handleExportMap}
              disabled={exporting}
              data-cy='export-war-map-btn'
            >
              <Camera className='w-4 h-4 mr-1' />
              {exporting ? '…' : t.game.war.exportMap}
            </Button>
            <Button
              variant='outline'
              onClick={handleExportList}
              disabled={exporting}
              data-cy='export-war-list-btn'
            >
              <Camera className='w-4 h-4 mr-1' />
              {exporting ? '…' : t.game.war.exportList}
            </Button>
          </>
        )}
        {/* Banned champions */}
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-sm shrink-0'>{t.game.war.bans.label}:</span>
          {!currentWar || currentWar.banned_champions.length === 0 ? (
            <span className='text-sm'>{t.game.war.bans.none}</span>
          ) : (
            currentWar.banned_champions.map((c) => (
              <div
                key={c.id}
                title={c.name}
                data-cy={`ban-display-${c.id}`}
                className='flex flex-col items-center gap-0.5'
              >
                <ChampionPortrait
                  imageUrl={c.image_url}
                  name={c.name}
                  rarity={'7r6'}
                  size={45}
                  is_saga_attacker={c.is_saga_attacker}
                  is_saga_defender={c.is_saga_defender}
                  sagaMode='attacker'
                />
              </div>
            ))
          )}
          {canManageWar && (
            <Button
              variant='outline'
              onClick={onEditClick}
              data-cy='edit-war-btn'
            >
              <Pencil className='size-4 mr-2' /> {t.game.war.editWar}
            </Button>
          )}
        </div>
        {/* End war button */}
        {canManageWar && (
          <Button
            variant='destructive'
            onClick={() => setShowEndConfirm(true)}
            className='ml-auto'
            data-cy='end-war-btn'
          >
            {t.game.war.endWar}
          </Button>
        )}
      </div>

      {warLoading ? (
        <FullPageSpinner />
      ) : (
        <div className='flex flex-col-reverse lg:flex-row gap-4'>
          <div className='overflow-x-auto flex-1 min-w-0 rounded-xl border bg-card shadow-sm'>
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
                canManage={canManageWar && warMode === WarMode.Defenders && !exporting}
                dimmedNodes={exporting ? undefined : dimmedNodes}
                prefightNodes={prefightNodes}
                noteNodes={noteNodes}
                format={currentSeason?.format ?? 'regular'}
              />
            </div>
          </div>
          <div
            className={cn(
              exporting
                ? 'w-full'
                : 'w-84 shrink-0 lg:self-start lg:sticky lg:top-0 lg:max-h-[calc(100vh-2rem)]',
              'flex flex-col'
            )}
          >
            <WarAttackerPanel
              playerFilter={playerFilter}
              onPlayerChange={setPlayerFilter}
              combatFilter={combatFilter}
              onCombatFilterChange={setCombatFilter}
              exporting={exporting}
              exportRef={exportAttackersRef}
              nodeCount={currentSeason?.node_count ?? 50}
              maxAttackers={currentSeason?.max_attackers_per_member ?? 3}
            />
          </div>
        </div>
      )}
    </div>
  )
}
