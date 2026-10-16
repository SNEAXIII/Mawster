'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/app/i18n'
import { shortenChampionName } from '@/app/services/roster'
import type { AvailablePrefightAttacker } from '@/app/services/war'
import type { CatalogPick } from './use-catalog-picks'
import InfoChampionTile from './info-champion-tile'

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
  onPick: (a: AvailablePrefightAttacker) => void
  onPickUnrecorded: (p: CatalogPick) => void
}

/** One group per player: their recorded copies, then their unrecorded ones. */
export default function PrefightPlayerGroups({
  loading,
  error,
  groups,
  picks,
  onPick,
  onPickUnrecorded,
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
      {group.attackers.map((a) => (
        <InfoChampionTile
          key={a.champion_user_id}
          champion={a}
          label={shortenChampionName(a.champion_name)}
          badge={a.is_on_defense ? 'on_defense' : undefined}
          onPick={() => onPick(a)}
          dataCy={`prefight-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
        />
      ))}
      {group.picks.map((p) => (
        <InfoChampionTile
          key={`unrecorded-${p.champion_id}`}
          champion={p}
          label={shortenChampionName(p.champion_name)}
          badge='not_in_roster'
          onPick={() => onPickUnrecorded(p)}
          dataCy={`prefight-pick-unrecorded-${p.champion_name.replaceAll(/\s+/g, '-')}`}
        />
      ))}
    </PickGroup>
  ))
}
