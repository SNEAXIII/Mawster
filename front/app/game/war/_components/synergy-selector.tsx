'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { providerOf, type AvailableAttacker } from '@/app/services/war'
import { useWar } from '@/app/contexts/war-context'
import { keepBestCopy } from './use-available-attackers'
import InfoChampionTile from './info-champion-tile'

interface SynergySelectorDialogProps {
  open: boolean
  onClose: () => void
  targetChampionUserId: string
  targetGameAccountId: string
  targetChampionName: string
}

export default function SynergySelectorDialog({
  open,
  onClose,
  targetChampionUserId,
  targetGameAccountId,
  targetChampionName,
}: Readonly<SynergySelectorDialogProps>) {
  const { t } = useI18n()
  const {
    selectedAllianceId,
    activeWarId,
    selectedBg,
    handleAddSynergy,
    synergies,
    loadAvailableAttackers,
  } = useWar()
  const [attackers, setAttackers] = useState<AvailableAttacker[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    if (!selectedAllianceId || !activeWarId) return
    setLoading(true)
    loadAvailableAttackers(targetGameAccountId)
      .then(setAttackers)
      .catch(() => {})
      .finally(() => setLoading(false))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAllianceId, activeWarId, selectedBg, targetGameAccountId])

  const usedSynergyIds = new Set(synergies.map((s) => s.champion_user_id))
  const available = keepBestCopy(
    attackers.filter(
      (a) => !usedSynergyIds.has(a.champion_user_id) && a.champion_user_id !== targetChampionUserId
    )
  )
  const filtered = query
    ? available.filter((a) => {
        const q = query.toLowerCase()
        return (
          a.champion_name.toLowerCase().includes(q) ||
          (a.champion_alias ?? '').toLowerCase().includes(q)
        )
      })
    : available

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
        <div className='px-4 pt-3'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.game.war.synergy.search}
            data-cy='synergy-search'
          />
        </div>
        <div className='overflow-y-auto p-4'>
          {loading && (
            <p className='text-sm text-muted-foreground'>{t.game.war.availableAttackersError}</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className='text-sm text-muted-foreground'>{t.game.war.noAvailableAttackers}</p>
          )}
          {!loading && filtered.length > 0 && (
            <div className='grid grid-cols-3 gap-2'>
              {filtered.map((a) => (
                <InfoChampionTile
                  key={a.champion_user_id}
                  champion={a}
                  label={a.champion_name}
                  dataCy={`synergy-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
                  onPick={() => {
                    onClose()
                    void handleAddSynergy(providerOf(a), targetChampionUserId)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
