'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#94a3b8'];
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';
import { getChampionImageUrl } from '@/app/services/champions';

interface MemberChampionChartProps {
  data: ChampionUsageItem[];
  metric: 'fights' | 'kos';
  onMetricChange: (m: 'fights' | 'kos') => void;
  onViewDetail: () => void;
  loading: boolean;
  playerName: string | null;
}

export function MemberChampionChart({
  data,
  metric,
  onMetricChange,
  onViewDetail,
  loading,
  playerName,
}: MemberChampionChartProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) =>
        metric === 'fights' ? b.fight_count - a.fight_count : b.total_kos - a.total_kos,
      ),
    [data, metric],
  );

  const top5 = sorted.slice(0, 5);
  const othersValue = sorted
    .slice(5)
    .reduce((sum, c) => sum + (metric === 'fights' ? c.fight_count : c.total_kos), 0);

  const chartConfig = { value: { label: metric === 'fights' ? stat.chartByFights : stat.chartByKos } };

  const othersEntry = othersValue > 0
    ? [{ key: 'others', name: stat.others, value: othersValue }]
    : [];

  const chartData = [
    ...top5.map((c, i) => ({
      key: `c${i}`,
      name: c.champion_name,
      value: metric === 'fights' ? c.fight_count : c.total_kos,
    })),
    ...othersEntry,
  ];

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-muted-foreground'>
          {playerName ?? stat.allianceView}
        </span>
        <div className='flex gap-1'>
          <Button
            size='sm'
            variant={metric === 'fights' ? 'default' : 'outline'}
            onClick={() => onMetricChange('fights')}
            data-cy='chart-metric-fights'
          >
            {stat.chartByFights}
          </Button>
          <Button
            size='sm'
            variant={metric === 'kos' ? 'default' : 'outline'}
            onClick={() => onMetricChange('kos')}
            data-cy='chart-metric-kos'
          >
            {stat.chartByKos}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className='text-sm text-muted-foreground text-center py-8'>{stat.loadingChart}</p>
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
              <Pie data={chartData} dataKey='value' nameKey='name' label>
                {chartData.map((entry, i) => (
                  <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className='flex flex-col gap-1'>
            {top5.map((c, i) => {
              const imgUrl = getChampionImageUrl(c.image_url, 40);
              const value = metric === 'fights' ? c.fight_count : c.total_kos;
              return (
                <li key={c.champion_id} className='flex items-center gap-2 text-sm'>
                  <span className='shrink-0 w-2.5 h-2.5 rounded-full' style={{ backgroundColor: COLORS[i] }} />
                  {imgUrl ? (
                    <img src={imgUrl} alt={c.champion_name} className='w-7 h-7 rounded object-cover shrink-0' />
                  ) : (
                    <span className='w-7 h-7 rounded bg-muted shrink-0' />
                  )}
                  <span className='truncate flex-1'>{c.champion_name}</span>
                  <span className='text-muted-foreground shrink-0'>{value}</span>
                </li>
              );
            })}
            {othersValue > 0 && (
              <li className='flex items-center gap-2 text-sm'>
                <span className='shrink-0 w-2.5 h-2.5 rounded-full' style={{ backgroundColor: COLORS[5] }} />
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
