'use client'

import { useMemo } from 'react'
import { useI18n } from '@/app/i18n'
import { RosterEntry, RARITY_LABELS, UpgradeRequest } from '@/app/services/roster'
import RosterChampionCard, { RosterChampionCardProps } from './roster-champion-card'

/** Everything the grid forwards as-is to each card */
type RosterCardActions = Omit<RosterChampionCardProps, 'entry' | 'pendingRequestId'>

interface RosterGridProps extends RosterCardActions {
  groupedRoster: [string, RosterEntry[]][]
  /** Pending upgrade requests — used to show cancel button instead of upgrade arrow */
  upgradeRequests?: UpgradeRequest[]
  /** True when filters are active — changes the empty-state message */
  isFiltered?: boolean
}

export default function RosterGrid({
  groupedRoster,
  upgradeRequests,
  isFiltered = false,
  ...cardActions
}: RosterGridProps) {
  const { t } = useI18n()

  /** champion_user_id → pending request id, built once instead of scanning per card */
  const pendingByChampion = useMemo(
    () => new Map((upgradeRequests ?? []).map((r) => [r.champion_user_id, r.id])),
    [upgradeRequests]
  )

  if (groupedRoster.length === 0) {
    return (
      <p
        className='text-muted-foreground'
        data-cy={isFiltered ? 'roster-no-results' : 'roster-empty'}
      >
        {isFiltered ? t.roster.filter.noResults : t.roster.empty}
      </p>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {groupedRoster.map(([rarity, entries]) => (
        <div
          key={rarity}
          data-cy={`rarity-group-${rarity}`}
        >
          <h3 className='text-base font-semibold mb-1.5 flex items-center gap-2'>
            <span className='bg-muted text-yellow-400 px-2 py-0.5 rounded text-xs font-bold'>
              {RARITY_LABELS[rarity]}
            </span>
            <span className='text-xs text-muted-foreground'>({entries.length})</span>
          </h3>
          <div className='grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1.5'>
            {entries.map((entry) => (
              <RosterChampionCard
                key={entry.id}
                {...cardActions}
                entry={entry}
                pendingRequestId={pendingByChampion.get(entry.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
