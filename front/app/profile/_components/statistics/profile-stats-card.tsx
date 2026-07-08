'use client';

import { useI18n } from '@/app/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlayerStatsCard, PlayerSeasonAlliance } from '@/app/services/player-stats';

interface Props {
  stats: PlayerStatsCard;
  alliances: PlayerSeasonAlliance[];
}

export function ProfileStatsCard({ stats, alliances }: Readonly<Props>) {
  const { t } = useI18n();
  const s = t.profile.statistics;
  const items = [
    { label: s.ratio, value: `${stats.ratio}%` },
    { label: s.kos, value: stats.total_kos },
    { label: s.notFought, value: stats.total_not_fought },
    { label: s.fights, value: Math.round(stats.total_fights) },
    { label: s.assists, value: stats.total_assists },
    { label: s.wars, value: stats.wars_participated },
  ];
  return (
    <Card data-cy='profile-stats-card'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm'>{s.title}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='grid grid-cols-3 sm:grid-cols-6 gap-3'>
          {items.map((it) => (
            <div key={it.label} className='flex flex-col'>
              <span className='text-lg font-semibold'>{it.value}</span>
              <span className='text-xs text-muted-foreground'>{it.label}</span>
            </div>
          ))}
        </div>
        {alliances.length > 0 && (
          <div className='text-xs text-muted-foreground' data-cy='profile-stats-alliances'>
            {s.alliancesLabel}: {alliances.map((a) => `[${a.tag}] ${a.name}`).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
