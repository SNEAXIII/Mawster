'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import type { AvailableAttacker } from '@/app/services/war'
import { useWar } from '@/app/contexts/war-context'
import { keepBestCopy } from './use-available-attackers'
import { catalogCandidates, useCatalogPicks } from './use-catalog-picks'
import SelectorToggles, { useSelectorToggles } from './selector-toggles'
import SynergySelectorGrid from './synergy-selector-grid'

interface SynergySelectorDialogProps {
  open: boolean
  onClose: () => void
  targetChampionUserId: string
  targetChampionId: string
  targetGameAccountId: string
  targetChampionName: string
}

export default function SynergySelectorDialog({
  open,
  onClose,
  targetChampionUserId,
  targetChampionId,
  targetGameAccountId,
  targetChampionName,
}: Readonly<SynergySelectorDialogProps>) {
  const { t } = useI18n()
  const {
    selectedAllianceId,
    activeWarId,
    selectedBg,
    currentWar,
    handleAddSynergy,
    synergies,
    loadAvailableAttackers,
  } = useWar()
  const [attackers, setAttackers] = useState<AvailableAttacker[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const toggles = useSelectorToggles(open)
  const { showDefenders, showCatalog } = toggles
  const { catalog } = useCatalogPicks(open, { prefightOnly: false })
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    if (!selectedAllianceId || !activeWarId) return
    setLoading(true)
    loadAvailableAttackers(targetGameAccountId, undefined, true)
      .then(setAttackers)
      .catch(() => {})
      .finally(() => setLoading(false))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAllianceId, activeWarId, selectedBg, targetGameAccountId])

  const bannedIds = new Set((currentWar?.banned_champions ?? []).map((c) => c.id))
  const usedChampionIds = new Set(
    synergies.filter((s) => s.game_account_id === targetGameAccountId).map((s) => s.champion_id)
  )
  const isFree = (c: { champion_id: string }) =>
    c.champion_id !== targetChampionId && !usedChampionIds.has(c.champion_id)
  const matches = (c: { champion_name: string; champion_alias: string | null }) => {
    const q = query.toLowerCase()
    return (
      c.champion_name.toLowerCase().includes(q) ||
      (c.champion_alias ?? '').toLowerCase().includes(q)
    )
  }
  const recorded = keepBestCopy(
    attackers.filter((a) => isFree(a) && (showDefenders || !a.is_on_defense))
  ).filter(matches)
  const picks = showCatalog
    ? catalogCandidates(catalog, attackers, bannedIds, { id: targetGameAccountId, pseudo: '' })
        .filter(isFree)
        .filter(matches)
    : []

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-md max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='synergy-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.synergy.add} — {targetChampionName}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <div className='px-4 py-3'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.game.war.synergy.search}
            data-cy='synergy-search'
          />
        </div>
        <SelectorToggles
          {...toggles}
          dataCyPrefix='synergy'
        />
        <div className='overflow-y-auto p-4'>
          {loading && (
            <p className='text-sm text-muted-foreground'>{t.game.war.availableAttackersError}</p>
          )}
          {!loading && recorded.length + picks.length === 0 && (
            <p className='text-sm text-muted-foreground'>{t.game.war.noAvailableAttackers}</p>
          )}
          {!loading && recorded.length + picks.length > 0 && (
            <SynergySelectorGrid
              recorded={recorded}
              picks={picks}
              onPick={(provider) => {
                onClose()
                void handleAddSynergy(provider, targetChampionUserId)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
