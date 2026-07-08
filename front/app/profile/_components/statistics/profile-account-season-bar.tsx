'use client';

import { useI18n } from '@/app/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GameAccount } from '@/app/services/game';
import type { PlayerSeasonOption } from '@/app/services/player-stats';

interface Props {
  accounts: GameAccount[];
  accountId: string;
  onAccountChange: (id: string) => void;
  seasons: PlayerSeasonOption[];
  seasonId: string | undefined;
  onSeasonChange: (id: string | undefined) => void;
}

export function ProfileAccountSeasonBar({
  accounts,
  accountId,
  onAccountChange,
  seasons,
  seasonId,
  onSeasonChange,
}: Readonly<Props>) {
  const { t } = useI18n();
  const s = t.profile.statistics;
  return (
    <div className='flex flex-wrap items-center gap-3'>
      {accounts.length > 1 && (
        <Select value={accountId} onValueChange={onAccountChange}>
          <SelectTrigger className='w-44' data-cy='profile-account-select'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.game_pseudo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        value={seasonId ?? 'all'}
        onValueChange={(v) => onSeasonChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className='w-44' data-cy='profile-season-select'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all' data-cy='profile-season-all'>
            {s.allSeasons}
          </SelectItem>
          {seasons.map((se) => (
            <SelectItem key={se.season_id} value={se.season_id} data-cy={`profile-season-${se.number}`}>
              {`S${se.number}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
