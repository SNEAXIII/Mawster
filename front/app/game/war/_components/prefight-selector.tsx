'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { providerOf, slotKey, type AvailableAttacker, type Provider } from '@/app/services/war'
import { useWar } from '@/app/contexts/war-context'
import { useAvailableAttackers } from './use-available-attackers'
import { catalogCandidates, useCatalogPicks } from './use-catalog-picks'
import InfoSelectorFilters from './info-selector-filters'
import SelectorToggles, { useSelectorToggles } from './selector-toggles'
import PrefightPlayerGroups from './prefight-player-groups'
import PrefightCatalogGroup from './prefight-catalog-group'

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
    loadAvailableAttackers,
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
  const [roster, setRoster] = useState<AvailableAttacker[]>([])
  const { catalog } = useCatalogPicks(showCatalog, { prefightOnly: true })
  useEffect(() => {
    if (!open) setRoster([])
    if (!open || !showCatalog || !ready) return
    loadAvailableAttackers(undefined, undefined, true)
      .then(setRoster)
      .catch(() => {})
  }, [open, showCatalog, ready, loadAvailableAttackers])

  const owners = showCatalog ? [...available, ...roster] : available
  const accounts = new Map(
    owners.map((a) => [a.game_pseudo, { id: a.game_account_id, pseudo: a.game_pseudo }])
  )
  const selectedAccount = accounts.get(playerFilter)
  const bannedIds = new Set((currentWar?.banned_champions ?? []).map((c) => c.id))
  // Only exclude champions already prefighting THIS specific node (same champion can prefight other nodes)
  const usedPrefightIds = new Set(
    prefights.filter((p) => p.target_node_number === targetNodeNumber).map(slotKey)
  )
  const filtered = filterBySearch(
    available.filter(
      (a) =>
        (showDefenders || !a.is_on_defense) &&
        !usedPrefightIds.has(
          slotKey({ ...a, champion_user_id: a.is_on_defense ? null : a.champion_user_id })
        )
    )
  )
  const picks =
    showCatalog && selectedAccount
      ? filterBySearch(
          catalogCandidates(catalog, owners, bannedIds, selectedAccount).filter(
            (p) => !usedPrefightIds.has(p.champion_id)
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
            hideEmpty={showCatalog}
            onPick={(a) => pick(providerOf(a))}
          />
          {showCatalog && !loading && !error && (
            <PrefightCatalogGroup
              picks={picks}
              pickPlayerFirst={!playerFilter}
              onPick={(p) =>
                pick({ champion_id: p.champion_id, game_account_id: p.game_account_id })
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
