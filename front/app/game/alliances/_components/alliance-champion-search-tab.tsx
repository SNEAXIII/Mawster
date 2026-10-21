'use client'

import { useState } from 'react'
import { useI18n } from '@/app/i18n'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { Button } from '@/components/ui/button'
import AllianceSelect from '@/app/game/_components/alliance-select'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'
import RosterFilterBar from '@/components/roster/roster-filter-bar'
import {
  EMPTY_FILTERS,
  type RosterFilters,
  isFilterActive,
} from '@/components/roster/roster-filters'
import UpgradeRequestDialogs from '@/components/upgrade-request-dialogs'
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests'
import { CLASS_ORDER } from '@/app/lib/champion-class'
import { cn } from '@/app/lib/utils'
import { useAllianceRosterSearch } from '../_viewmodels/use-alliance-roster-search'
import AllianceChampionGroup from './alliance-champion-group'
import ChampionSearchGroupSelect from './champion-search-group-select'

const AVAILABLE_CLASSES = CLASS_ORDER

interface Props {
  alliances: AllianceWithVisitorFlag[]
  selectedAllianceId: string
  onAllianceChange: (id: string) => void
}

export default function AllianceChampionSearchTab({
  alliances,
  selectedAllianceId,
  onAllianceChange,
}: Readonly<Props>) {
  const { t } = useI18n()
  const cs = t.game.alliances.championSearch
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS)
  const [group, setGroup] = useState('all')
  const [lastAllianceId, setLastAllianceId] = useState(selectedAllianceId)
  const [showAll, setShowAll] = useState(false)
  const upgrade = useUpgradeRequests()

  // Reset the group filter when the alliance changes. Done during render rather than
  // in an effect so `query` is rebuilt before the fetch effect runs — an effect would
  // fire one fetch with the previous group and another with 'all'.
  if (lastAllianceId !== selectedAllianceId) {
    setLastAllianceId(selectedAllianceId)
    setGroup('all')
    setShowAll(false)
  }

  const { groups, loading, canRequestUpgrade } = useAllianceRosterSearch(
    selectedAllianceId,
    filters,
    group,
    showAll
  )

  return (
    <div className='flex flex-col gap-4'>
      {alliances.length > 1 && (
        <div className='flex flex-wrap items-center gap-2'>
          <AllianceSelect
            alliances={alliances}
            value={selectedAllianceId}
            onChange={onAllianceChange}
            dataCy='champion-search-alliance-select'
            placeholder={cs.selectAlliance}
          />
        </div>
      )}

      <RosterFilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
        availableClasses={AVAILABLE_CLASSES}
        leading={
          <ChampionSearchGroupSelect
            value={group}
            onChange={setGroup}
          />
        }
        trailing={
          <Button
            type='button'
            variant='outline'
            size='sm'
            aria-pressed={showAll}
            className={cn(showAll && 'bg-primary/10 border-primary text-primary')}
            onClick={() => setShowAll((v) => !v)}
            data-cy='champion-search-show-all'
          >
            {cs.showAll}
          </Button>
        }
        showCount={false}
      />

      {loading && <FullPageSpinner />}
      {!loading && groups.length === 0 && (
        <p
          className='text-muted-foreground py-8 text-center'
          data-cy='champion-search-empty'
        >
          {isFilterActive(filters) ? cs.noResults : cs.empty}
        </p>
      )}
      {!loading && groups.length > 0 && (
        <div
          className='columns-3xs gap-3'
          data-cy='champion-search-results'
        >
          {groups.map((g) => (
            <div
              key={g.championId}
              className='mb-3 break-inside-avoid'
            >
              <AllianceChampionGroup
                championName={g.championName}
                championClass={g.championClass}
                imageUrl={g.imageUrl}
                entries={g.entries}
                canRequestUpgrade={canRequestUpgrade}
                onRequestUpgrade={upgrade.initiateUpgrade}
              />
            </div>
          ))}
        </div>
      )}

      <UpgradeRequestDialogs upgrade={upgrade} />
    </div>
  )
}
