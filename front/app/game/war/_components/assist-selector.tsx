'use client'

import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { shortenChampionName } from '@/app/services/roster'
import { useWar } from '@/app/contexts/war-context'
import { useAvailableAttackers, keepBestCopy } from './use-available-attackers'
import InfoChampionTile from './info-champion-tile'
import InfoSelectorFilters from './info-selector-filters'

interface AssistSelectorDialogProps {
  open: boolean
  onClose: () => void
  nodeNumber: number
  attackerGameAccountId: string | null
}

export default function AssistSelectorDialog({
  open,
  onClose,
  nodeNumber,
  attackerGameAccountId,
}: Readonly<AssistSelectorDialogProps>) {
  const { t } = useI18n()
  const { selectedAllianceId, activeWarId, handleAssignAssist, loadAvailableAttackers } = useWar()

  const guardedFetch = selectedAllianceId && activeWarId ? loadAvailableAttackers : null

  const {
    available,
    players,
    playerFilter,
    setPlayerFilter,
    championSearch,
    setChampionSearch,
    loading,
    error,
    filterBySearch,
    buildGroups,
  } = useAvailableAttackers(open, guardedFetch)

  const filtered = filterBySearch(
    keepBestCopy(
      available.filter(
        (a) => attackerGameAccountId === null || a.game_account_id !== attackerGameAccountId
      )
    )
  )
  const groups = buildGroups(filtered)

  let content: React.ReactNode
  if (loading) {
    content = <div className='text-center text-muted-foreground py-8'>{t.common.loading}</div>
  } else if (error) {
    content = (
      <div className='text-center text-destructive py-8'>{t.game.war.availableAttackersError}</div>
    )
  } else if (groups.length === 0) {
    content = (
      <div className='text-center text-muted-foreground py-8'>
        {t.game.war.assist.noneAvailable}
      </div>
    )
  } else {
    content = groups.map((group) => (
      <div key={group.gameAccountId}>
        <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1'>
          {group.pseudo}
        </div>
        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
          {group.attackers.map((a) => (
            <InfoChampionTile
              key={a.champion_user_id}
              champion={a}
              label={shortenChampionName(a.champion_name)}
              onPick={() => {
                void handleAssignAssist(nodeNumber, a.champion_user_id)
                onClose()
              }}
              dataCy={`assist-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
            />
          ))}
        </div>
      </div>
    ))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='assist-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.assist.add} — #{nodeNumber}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <InfoSelectorFilters
          championSearch={championSearch}
          onChampionSearch={setChampionSearch}
          players={players}
          playerFilter={playerFilter}
          onPlayerFilter={setPlayerFilter}
          dataCyPrefix='assist'
        />
        <Separator />
        <div className='overflow-y-auto flex-1 p-3 flex flex-col gap-4'>{content}</div>
      </DialogContent>
    </Dialog>
  )
}
