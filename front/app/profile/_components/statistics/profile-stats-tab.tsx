'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberChampionChart } from '@/app/components/statistics/member-champion-chart';
import { ChampionDetailModal } from '@/app/components/statistics/champion-detail-modal';
import { useProfileStats } from './use-profile-stats';
import { ProfileAccountSeasonBar } from './profile-account-season-bar';
import { ProfileStatsCard } from './profile-stats-card';
import { ProfileRatioEvolutionChart } from './profile-ratio-evolution-chart';

export function ProfileStatsTab() {
  const { t } = useI18n();
  const s = t.profile.statistics;
  const vm = useProfileStats();
  const currentName = vm.accounts.find((a) => a.id === vm.accountId)?.game_pseudo ?? null;

  if (vm.accountsLoading) {
    return <p className='text-sm text-muted-foreground py-6 text-center'>{s.loading}</p>;
  }

  if (vm.accounts.length === 0) {
    return (
      <p
        className='text-sm text-muted-foreground py-8 text-center'
        data-cy='profile-stats-empty'
      >
        {s.empty}
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-4' data-cy='profile-stats-tab'>
      <ProfileAccountSeasonBar
        accounts={vm.accounts}
        accountId={vm.accountId}
        onAccountChange={vm.setAccountId}
        seasons={vm.seasons}
        seasonId={vm.seasonId}
        onSeasonChange={vm.setSeasonId}
      />

      {vm.loading ? (
        <p className='text-sm text-muted-foreground py-6 text-center'>{s.loading}</p>
      ) : vm.error ? (
        <div className='flex flex-col items-center gap-2 py-6'>
          <p className='text-sm text-destructive'>{s.error}</p>
          <Button size='sm' variant='outline' onClick={vm.retry}>
            {s.retry}
          </Button>
        </div>
      ) : vm.stats ? (
        <>
          <ProfileStatsCard stats={vm.stats.card} alliances={vm.stats.alliances} />
          <div className='flex flex-col lg:flex-row gap-6'>
            <div className='flex-1 min-w-0'>
              <ProfileRatioEvolutionChart points={vm.stats.evolution} />
            </div>
            <div className='w-full lg:w-80 shrink-0'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberChampionChart
                    data={vm.usage}
                    metric={vm.metric}
                    onMetricChange={vm.setMetric}
                    perspective={vm.perspective}
                    onPerspectiveChange={vm.setPerspective}
                    onViewDetail={() => vm.setDetailOpen(true)}
                    loading={vm.loading}
                    playerName={currentName}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          <ChampionDetailModal
            open={vm.detailOpen}
            onClose={() => vm.setDetailOpen(false)}
            data={vm.usage}
            metric={vm.metric}
            playerName={currentName}
          />
        </>
      ) : null}
    </div>
  );
}
