'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/app/i18n'
import { shortenChampionName } from '@/app/services/roster'
import type { AvailablePrefightAttacker } from '@/app/services/war'
import InfoChampionTile from './info-champion-tile'

export function PickGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div>
      <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1'>
        {title}
      </div>
      <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>{children}</div>
    </div>
  )
}

interface PrefightPlayerGroupsProps {
  loading: boolean
  error: boolean
  groups: { pseudo: string; gameAccountId: string; attackers: AvailablePrefightAttacker[] }[]
  hideEmpty: boolean
  onPick: (a: AvailablePrefightAttacker) => void
}

/** The recorded copies, one group per player. */
export default function PrefightPlayerGroups({
  loading,
  error,
  groups,
  hideEmpty,
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
  if (groups.length === 0 && !hideEmpty) {
    return (
      <div className='text-center text-muted-foreground py-8'>
        {t.game.war.prefight.noneAvailable}
      </div>
    )
  }
  return groups.map((group) => (
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
    </PickGroup>
  ))
}
