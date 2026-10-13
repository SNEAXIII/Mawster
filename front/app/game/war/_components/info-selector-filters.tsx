'use client'

import { useI18n } from '@/app/i18n'
import { SearchInput } from '@/components/search-input'
import PlayerFilterSelect from '@/app/game/_components/player-filter-select'

interface InfoSelectorFiltersProps {
  championSearch: string
  onChampionSearch: (v: string) => void
  players: string[]
  playerFilter: string
  onPlayerFilter: (v: string) => void
  dataCyPrefix: string
}

export default function InfoSelectorFilters({
  championSearch,
  onChampionSearch,
  players,
  playerFilter,
  onPlayerFilter,
  dataCyPrefix,
}: Readonly<InfoSelectorFiltersProps>) {
  const { t } = useI18n()
  return (
    <div className='px-4 py-3 flex items-center gap-2'>
      <SearchInput
        value={championSearch}
        onChange={onChampionSearch}
        placeholder={t.game.war.searchChampion}
        className='flex-1'
        data-cy={`${dataCyPrefix}-search-champion`}
      />
      <PlayerFilterSelect
        players={players}
        value={playerFilter}
        onChange={onPlayerFilter}
        dataCy={`${dataCyPrefix}-player-filter`}
      />
    </div>
  )
}
