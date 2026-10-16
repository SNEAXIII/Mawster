'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/app/i18n'
import type { AvailablePrefightAttacker, Provider } from '@/app/services/war'
import type { CatalogPick } from './use-catalog-picks'
import ProviderTiles from './provider-tiles'

function PickGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div>
      <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1'>
        {title}
      </div>
      <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>{children}</div>
    </div>
  )
}

interface Group {
  pseudo: string
  gameAccountId: string
  attackers: AvailablePrefightAttacker[]
}

interface PrefightPlayerGroupsProps {
  loading: boolean
  error: boolean
  groups: Group[]
  picks: CatalogPick[]
  onPick: (provider: Provider) => void
}

/** One group per player: their recorded copies, then their unrecorded ones. */
export default function PrefightPlayerGroups({
  loading,
  error,
  groups,
  picks,
  onPick,
}: Readonly<PrefightPlayerGroupsProps>) {
  const { t } = useI18n()
  if (loading) {
    return <div className='text-center text-muted-foreground py-8'>{t.common.loading}</div>
  }
  if (error) {
    return (
      <div className='text-center text-destructive py-8'>{t.game.war.availableAttackersError}</div>
    )
  }
  const merged = new Map(groups.map((g) => [g.gameAccountId, { ...g, picks: [] as CatalogPick[] }]))
  for (const p of picks) {
    const group = merged.get(p.game_account_id) ?? {
      pseudo: p.game_pseudo,
      gameAccountId: p.game_account_id,
      attackers: [],
      picks: [],
    }
    group.picks.push(p)
    merged.set(p.game_account_id, group)
  }
  if (merged.size === 0) {
    return (
      <div className='text-center text-muted-foreground py-8'>
        {t.game.war.prefight.noneAvailable}
      </div>
    )
  }
  return [...merged.values()].map((group) => (
    <PickGroup
      key={group.gameAccountId}
      title={group.pseudo}
    >
      <ProviderTiles
        recorded={group.attackers}
        picks={group.picks}
        cyPrefix='prefight'
        onPick={onPick}
      />
    </PickGroup>
  ))
}
