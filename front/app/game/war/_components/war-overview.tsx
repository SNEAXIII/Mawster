'use client'

import { Link2, Shield, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'
import { useCurrentSeason } from '@/hooks/use-current-season'
import { Button } from '@/components/ui/button'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'
import { WarMode } from './war-types'
import SeasonBanner from './season-banner'
import WarStatusBadge from './war-status-badge'
import WarProgressBadge from './war-progress-badge'
import WarBans from './war-bans'
import WarActions from './war-actions'

interface WarOverviewProps {
  onEditClick: () => void
  onExportMap: () => void
  onExportList: () => void
  exporting: boolean
}

/** Two rows that never mix: who and how it goes, then what to look at and do. */
export default function WarOverview(props: Readonly<WarOverviewProps>) {
  const { t } = useI18n()
  const {
    currentWar,
    selectedBg,
    handleBgChange,
    canPlaceWar,
    warMode,
    setWarMode,
    alliances,
    selectedAllianceId,
  } = useWar()
  const currentSeason = useCurrentSeason()
  const alliance = alliances.find((a) => a.id === selectedAllianceId) ?? null

  const handleCopyShareLink = async () => {
    const url = `${window.location.origin}/game/war?alliance=${selectedAllianceId}&bg=${selectedBg}`
    await navigator.clipboard.writeText(url)
    toast.success(t.game.war.shareLinkCopied)
  }

  const meta = alliance
    ? [
        { key: 'elo', label: t.game.war.elo, value: alliance.elo },
        { key: 'tier', label: t.game.war.tier, value: alliance.tier },
      ]
    : []

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-3'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          {currentWar && (
            <h2 className='flex items-center gap-2 text-lg font-semibold'>
              <Swords className='size-4 text-muted-foreground' />
              <span data-cy='war-opponent-name'>vs {currentWar.opponent_name}</span>
            </h2>
          )}
          {currentWar && <WarStatusBadge status={currentWar.status} />}
          <SeasonBanner season={currentWar ? currentSeason : undefined} />
          {meta.map(({ key, label, value }) => (
            <span
              key={key}
              className='text-xs text-muted-foreground'
              data-cy={`war-${key}-badge`}
            >
              {label}:{' '}
              <span
                className='font-bold text-foreground'
                data-cy={`war-${key}-value`}
              >
                {value}
              </span>
            </span>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
          {currentWar && <WarProgressBadge />}
          <WarBans />
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <ToggleGroup dataCy='bg-picker'>
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
        </ToggleGroup>
        {canPlaceWar && (
          <ToggleGroup dataCy='war-mode-toggle'>
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
          </ToggleGroup>
        )}
        <div className='ml-auto flex flex-wrap items-center justify-end gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={handleCopyShareLink}
            aria-label={t.game.war.shareLink}
            title={t.game.war.shareLink}
            data-cy='share-war-link-btn'
          >
            <Link2 />
          </Button>
          <WarActions {...props} />
        </div>
      </div>
    </div>
  )
}
