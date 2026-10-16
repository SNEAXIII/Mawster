'use client'

import { useCallback } from 'react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { providerOf, type Provider } from '@/app/services/war'
import { useWar } from '@/app/contexts/war-context'
import { useAvailableAttackers } from './use-available-attackers'
import { catalogCandidates, useCatalogPicks } from './use-catalog-picks'
import InfoSelectorFilters from './info-selector-filters'
import SelectorToggles, { useSelectorToggles } from './selector-toggles'
import PrefightPlayerGroups from './prefight-player-groups'

interface PrefightSelectorDialogProps {
  open: boolean
  onClose: () => void
  targetNodeNumber: number
  targetGameAccountId: string
}

export default function PrefightSelectorDialog({
  open,
  onClose,
  targetNodeNumber,
}: Readonly<PrefightSelectorDialogProps>) {
  const { t } = useI18n()
  const {
    selectedAllianceId,
    activeWarId,
    currentWar,
    handleAddPrefight,
    prefights,
    loadAvailablePrefightAttackers,
  } = useWar()

  const ready = Boolean(selectedAllianceId && activeWarId)
  const fetchAll = useCallback(
    () => loadAvailablePrefightAttackers(true),
    [loadAvailablePrefightAttackers]
  )
  const {
    available,
    playerFilter,
    setPlayerFilter,
    championSearch,
    setChampionSearch,
    loading,
    error,
    filterBySearch,
    buildGroups,
  } = useAvailableAttackers(open, ready ? fetchAll : null)

  const toggles = useSelectorToggles(open)
  const { showDefenders, showCatalog } = toggles
  const { catalog } = useCatalogPicks(open, { prefightOnly: true })
  // `available` holds every owned pre-fight champion, defenders included: no roster to fetch.
  const accounts = new Map(
    available.map((a) => [a.game_pseudo, { id: a.game_account_id, pseudo: a.game_pseudo }])
  )
  const bannedIds = new Set((currentWar?.banned_champions ?? []).map((c) => c.id))
  const prefightKey = (c: { game_account_id: string; champion_id: string }) =>
    `${c.game_account_id}:${c.champion_id}`
  // Only exclude champions already prefighting THIS specific node (same champion can prefight other nodes)
  const usedPrefights = new Set(
    prefights.filter((p) => p.target_node_number === targetNodeNumber).map(prefightKey)
  )
  const isFree = (c: { game_account_id: string; champion_id: string }) =>
    !usedPrefights.has(prefightKey(c))
  const filtered = filterBySearch(
    available.filter((a) => (showDefenders || !a.is_on_defense) && isFree(a))
  )
  // The pre-fight catalog is a handful of champions: every player gets theirs, no pick needed.
  const picks = showCatalog
    ? filterBySearch(
        [...accounts.values()].flatMap((account) =>
          catalogCandidates(catalog, available, bannedIds, account).filter(isFree)
        )
      )
    : []
  const pick = (provider: Provider) => {
    void handleAddPrefight(provider, targetNodeNumber)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='prefight-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.prefight.add} —
            {t.game.war.prefight.for.replace('#{node}', String(targetNodeNumber))}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <InfoSelectorFilters
          championSearch={championSearch}
          onChampionSearch={setChampionSearch}
          players={Array.from(accounts.keys())}
          playerFilter={playerFilter}
          onPlayerFilter={setPlayerFilter}
          dataCyPrefix='prefight'
        />
        <SelectorToggles
          {...toggles}
          dataCyPrefix='prefight'
        />
        <Separator />
        <div className='overflow-y-auto flex-1 p-3 flex flex-col gap-4'>
          <PrefightPlayerGroups
            loading={loading}
            error={error}
            groups={buildGroups(filtered)}
            picks={picks}
            onPick={(a) => pick(providerOf(a))}
            onPickUnrecorded={(p) =>
              pick({ champion_id: p.champion_id, game_account_id: p.game_account_id })
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
