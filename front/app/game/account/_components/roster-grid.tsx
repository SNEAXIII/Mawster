'use client'

import { useI18n } from '@/app/i18n'
import { RosterEntry, RARITY_LABELS, UpgradeRequest } from '@/app/services/roster'
import RosterChampionCard from './roster-champion-card'

interface RosterGridProps {
  groupedRoster: [string, RosterEntry[]][]
  onEdit?: (entry: RosterEntry) => void
  onDelete?: (entry: RosterEntry) => void
  onUpgrade?: (entry: RosterEntry) => void
  onTogglePreferredAttacker?: (entry: RosterEntry) => void
  onAscend?: (entry: RosterEntry) => void
  readOnly?: boolean
  /** Pending upgrade requests — used to show cancel button instead of upgrade arrow */
  upgradeRequests?: UpgradeRequest[]
  /** Callback to cancel an upgrade request */
  onCancelRequest?: (requestId: string) => void
  /** True when filters are active — changes the empty-state message */
  isFiltered?: boolean
}

export default function RosterGrid({
  groupedRoster,
  onEdit,
  onDelete,
  onUpgrade,
  onTogglePreferredAttacker,
  onAscend,
  readOnly = false,
  upgradeRequests,
  onCancelRequest,
  isFiltered = false,
}: RosterGridProps) {
  const { t } = useI18n()

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
          <div className='grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 gap-1.5'>
            {entries.map((entry) => {
              const pending = upgradeRequests?.find((r) => r.champion_user_id === entry.id)
              return (
                <RosterChampionCard
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onUpgrade={onUpgrade}
                  onTogglePreferredAttacker={onTogglePreferredAttacker}
                  onAscend={onAscend}
                  readOnly={readOnly}
                  pendingRequestId={pending?.id}
                  onCancelRequest={onCancelRequest}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
