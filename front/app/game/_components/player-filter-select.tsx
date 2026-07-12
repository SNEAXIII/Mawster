'use client';

import { useI18n } from '@/app/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SearchablePlayerFilterSelect from './searchable-player-filter-select';

interface PlayerFilterSelectProps {
  players: string[];
  value: string;
  onChange: (v: string) => void;
  dataCy?: string;
  searchable?: boolean;
}

export default function PlayerFilterSelect({
  players,
  value,
  onChange,
  dataCy = 'player-filter',
  searchable = false,
}: Readonly<PlayerFilterSelectProps>) {
  const { t } = useI18n();

  if (players.length === 0) return null;

  if (searchable) {
    return (
      <SearchablePlayerFilterSelect
        players={players}
        value={value}
        onChange={onChange}
        dataCy={dataCy}
      />
    );
  }

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
        {players.map((player) => (
          <SelectItem
            key={player}
            value={player}
            data-cy={`${dataCy}-item`}
            data-cy-player={player}
          >
            {player}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
