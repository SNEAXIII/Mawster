'use client';

import { useI18n } from '@/app/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PlayerFilterSelectProps {
  players: string[];
  value: string;
  onChange: (v: string) => void;
  dataCy?: string;
}

export default function PlayerFilterSelect({
  players,
  value,
  onChange,
  dataCy = 'player-filter',
}: Readonly<PlayerFilterSelectProps>) {
  const { t } = useI18n();

  if (players.length === 0) return null;

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
          >
            {player}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
