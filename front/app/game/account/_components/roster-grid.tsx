'use client'

import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { type RosterEntry, RARITY_LABELS, type UpgradeRequest } from '@/app/services/roster'
import RosterChampionCard from './roster-champion-card'
import RosterChampionDialog, { type RosterChampionActions } from './roster-champion-dialog'

interface RosterGridProps extends RosterChampionActions {
  groupedRoster: [string, RosterEntry[]][]
  /** Unfiltered roster: the open dialog keeps its entry even once filters hide it */
  roster: RosterEntry[]
  readOnly?: boolean
  /** Pending upgrade requests — used to show cancel button instead of upgrade arrow */
  upgradeRequests?: UpgradeRequest[]
  /** True when filters are active — changes the empty-state message */
  isFiltered?: boolean
}

export default function RosterGrid({
  groupedRoster,
  upgradeRequests,
  isFiltered = false,
  roster,
  readOnly = false,
  ...actions
}: Readonly<RosterGridProps>) {
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string | null>(null)
  const openEntry = roster.find((e) => e.id === openId)
  const openDialog = useCallback((entry: RosterEntry) => setOpenId(entry.id), [])

  /** champion_user_id → pending request id, built once instead of scanning per card */
  const pendingByChampion = useMemo(
    () => new Map((upgradeRequests ?? []).map((r) => [r.champion_user_id, r.id])),
    [upgradeRequests]
  )

  const dialog = openEntry && (
    <RosterChampionDialog
      {...actions}
      entry={openEntry}
      pendingRequestId={pendingByChampion.get(openEntry.id)}
      open
      onOpenChange={(open) => !open && setOpenId(null)}
    />
  )

  if (groupedRoster.length === 0) {
    return (
      <>
        <p
          className='text-muted-foreground'
          data-cy={isFiltered ? 'roster-no-results' : 'roster-empty'}
        >
          {isFiltered ? t.roster.filter.noResults : t.roster.empty}
        </p>
        {dialog}
      </>
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
                entry={entry}
                readOnly={readOnly}
                onOpen={openDialog}
              />
            ))}
          </div>
        </div>
      ))}
      {dialog}
    </div>
  )
}
