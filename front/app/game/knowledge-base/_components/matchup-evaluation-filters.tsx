'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AllianceSelect from '@/app/game/_components/alliance-select'
import PlayerFilterSelect from '@/app/game/_components/player-filter-select'
import ChampionFilterSelect from './champion-filter-select'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'
import type { MatchupFiltersState } from '../_viewmodels/use-matchups-viewmodel'

interface Props {
  alliances: AllianceWithVisitorFlag[]
  allianceId: string
  onAllianceChange: (id: string) => void
  players: string[]
  filters: MatchupFiltersState
  onChange: <K extends keyof MatchupFiltersState>(key: K, value: MatchupFiltersState[K]) => void
  onClear: () => void
}

export default function MatchupEvaluationFilters({
  alliances,
  allianceId,
  onAllianceChange,
  players,
  filters,
  onChange,
  onClear,
}: Readonly<Props>) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase

  return (
    <div className='flex flex-wrap gap-2 items-center'>
      <AllianceSelect
        alliances={alliances}
        value={allianceId}
        onChange={onAllianceChange}
        dataCy='matchup-filter-alliance'
      />
      <PlayerFilterSelect
        players={players}
        value={filters.gameAccountId}
        onChange={(v) => onChange('gameAccountId', v)}
        dataCy='matchup-filter-player'
        searchable
      />
      <ChampionFilterSelect
        value={filters.championId}
        onChange={(id) => onChange('championId', id)}
        placeholder={kb.filterAttacker}
        data-cy='matchup-filter-attacker'
      />
      <ChampionFilterSelect
        value={filters.defenderChampionId}
        onChange={(id) => onChange('defenderChampionId', id)}
        placeholder={kb.filterDefender}
        data-cy='matchup-filter-defender'
      />
      <Input
        className='w-24'
        type='number'
        min={1}
        max={50}
        placeholder={kb.filterNode}
        value={filters.nodeNumber}
        onChange={(e) => onChange('nodeNumber', e.target.value)}
        data-cy='matchup-filter-node'
      />
      <Button
        variant='outline'
        onClick={onClear}
        data-cy='matchup-filter-clear'
      >
        {kb.clearFilters}
      </Button>
    </div>
  )
}
