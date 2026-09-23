'use client'

import { useI18n } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SearchablePlayerFilterSelect from './searchable-player-filter-select'
import { useOwnPlayersFirst } from './use-own-players-first'

interface PlayerFilterSelectProps {
  players: string[]
  value: string
  onChange: (v: string) => void
  dataCy?: string
  searchable?: boolean
}

export default function PlayerFilterSelect({
  players,
  value,
  onChange,
  dataCy = 'player-filter',
  searchable = false,
}: Readonly<PlayerFilterSelectProps>) {
  const { t } = useI18n()
  const { own, others } = useOwnPlayersFirst(players)

  if (players.length === 0) return null

  if (searchable) {
    return (
      <SearchablePlayerFilterSelect
        own={own}
        others={others}
        value={value}
        onChange={onChange}
        dataCy={dataCy}
      />
    )
  }

  const renderItem = (player: string) => (
    <SelectItem
      key={player}
      value={player}
      data-cy={`${dataCy}-item`}
      data-cy-player={player}
    >
      {player}
    </SelectItem>
  )

  return (
    <Select
      value={value || 'all'}
      onValueChange={(val) => onChange(val === 'all' ? '' : val)}
    >
      <SelectTrigger
        className='h-7 w-24 text-xs'
        data-cy={dataCy}
      >
        <SelectValue placeholder={t.game.defense.playerFilter} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>{t.game.defense.allFilter}</SelectItem>
        {own.map(renderItem)}
        {own.length > 0 && others.length > 0 && <SelectSeparator data-cy={`${dataCy}-separator`} />}
        {others.map(renderItem)}
      </SelectContent>
    </Select>
  )
}
