'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Pie, PieChart, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';
import { getChampionImageUrl } from '@/app/services/champions';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#eab308', '#ec4899', '#84cc16', '#f43f5e'];
const OTHERS_COLOR = '#64748b';

interface MemberChampionChartProps {
  data: ChampionUsageItem[];
  metric: 'all' | 'kos' | 'deathless';
  onMetricChange: (m: 'all' | 'kos' | 'deathless') => void;
  perspective: 'attacker' | 'defender';
  onPerspectiveChange: (p: 'attacker' | 'defender') => void;
  onViewDetail: () => void;
  loading: boolean;
  playerName: string | null;
  topN?: number;
}

export function MemberChampionChart({
  data,
  metric,
  onMetricChange,
  perspective,
  onPerspectiveChange,
  onViewDetail,
  loading,
  playerName,
  topN = 8,
}: Readonly<MemberChampionChartProps>) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const isKos = metric === 'kos';

  const sorted = useMemo(
    () =>
      [...data]
        .filter((c) => !isKos || c.total_kos > 0)
        .sort((a, b) => isKos ? b.total_kos - a.total_kos : b.fight_count - a.fight_count),
    [data, isKos],
  );

  const getValue = (c: ChampionUsageItem) => isKos ? c.total_kos : c.fight_count;

  const top5 = sorted.slice(0, topN);
  const othersValue = sorted.slice(topN).reduce((sum, c) => sum + getValue(c), 0);

  const chartLabel = isKos ? stat.chartByKos : metric === 'deathless' ? stat.chartByDeathless : stat.chartByAll;
  const chartConfig = { value: { label: chartLabel } };

  const othersEntry = othersValue > 0
    ? [{ key: 'others', name: stat.others, value: othersValue }]
    : [];

  const chartData = [
    ...top5.map((c, i) => ({
      key: `c${i}`,
      name: c.champion_name,
      value: getValue(c),
    })),
    ...othersEntry,
  ];

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1.5'>
        <span className='text-sm font-medium text-muted-foreground'>
          {playerName ?? stat.allianceView}
        </span>
        <div className='flex gap-1'>
          <Button
            size='sm'
            className='flex-1'
            variant={perspective === 'attacker' ? 'default' : 'outline'}
            onClick={() => onPerspectiveChange('attacker')}
            data-cy='chart-perspective-attacker'
          >
            {stat.chartAttacker}
          </Button>
          <Button
            size='sm'
            className='flex-1'
            variant={perspective === 'defender' ? 'default' : 'outline'}
            onClick={() => onPerspectiveChange('defender')}
            data-cy='chart-perspective-defender'
          >
            {stat.chartDefender}
          </Button>
        </div>
        <div className='flex gap-1'>
          <Button
            size='sm'
            className='flex-1'
            variant={metric === 'deathless' ? 'default' : 'outline'}
            onClick={() => onMetricChange('deathless')}
            data-cy='chart-metric-deathless'
          >
            {stat.chartByDeathless}
          </Button>
          <Button
            size='sm'
            className='flex-1'
            variant={metric === 'all' ? 'default' : 'outline'}
            onClick={() => onMetricChange('all')}
            data-cy='chart-metric-all'
          >
            {stat.chartByAll}
          </Button>
          <Button
            size='sm'
            className='flex-1'
            variant={metric === 'kos' ? 'default' : 'outline'}
            onClick={() => onMetricChange('kos')}
            data-cy='chart-metric-kos'
          >
            {stat.chartByKos}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='flex flex-col items-center gap-3'>
          <Skeleton className='size-36 rounded-full' />
          <div className='w-full flex flex-col gap-2'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='flex items-center gap-2'>
                <Skeleton className='size-2.5 rounded-full shrink-0' />
                <Skeleton className='h-3 rounded flex-1' />
                <Skeleton className='h-3 w-5 rounded shrink-0' />
              </div>
            ))}
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <p className='text-sm text-muted-foreground text-center py-8'>{stat.empty}</p>
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className='w-full h-55 [&_.recharts-pie-label-text]:fill-foreground'
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={chartData} dataKey='value' nameKey='name' outerRadius={72} label>
                {chartData.map((entry, i) => (
                  <Cell key={entry.key} fill={entry.key === 'others' ? OTHERS_COLOR : COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className='flex flex-col gap-1'>
            {top5.map((c, i) => {
              const imgUrl = getChampionImageUrl(c.image_url, 40);
              const value = getValue(c);
              return (
                <li key={c.champion_id} className='flex items-center gap-2 text-sm'>
                  <span className='shrink-0 size-2.5 rounded-full' style={{ backgroundColor: COLORS[i] }} />
                  {imgUrl ? (
                    <img src={imgUrl} alt={c.champion_name} className='size-7 rounded object-cover shrink-0' />
                  ) : (
                    <span className='size-7 rounded bg-muted shrink-0' />
                  )}
                  <span className='truncate flex-1'>{c.champion_name}</span>
                  <span className='text-muted-foreground shrink-0'>{value}</span>
                </li>
              );
            })}
            {othersValue > 0 && (
              <li className='flex items-center gap-2 text-sm'>
                <span className='shrink-0 size-2.5 rounded-full' style={{ backgroundColor: OTHERS_COLOR }} />
                <span className='truncate flex-1 text-muted-foreground'>{stat.others}</span>
                <span className='text-muted-foreground shrink-0'>{othersValue}</span>
              </li>
            )}
          </ul>
        </>
      )}

      {data.length > 0 && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onViewDetail}
          className='self-end'
          data-cy='chart-see-detail'
        >
          {stat.seeDetail}
        </Button>
      )}
    </div>
  );
}
