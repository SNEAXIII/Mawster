'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#94a3b8'];

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

  const sorted = [...data].sort((a, b) =>
    metric === 'fights' ? b.fight_count - a.fight_count : b.total_kos - a.total_kos,
  );
  const top5 = sorted.slice(0, 5);
  const othersValue = sorted
    .slice(5)
    .reduce((sum, c) => sum + (metric === 'fights' ? c.fight_count : c.total_kos), 0);

  const chartData = [
    ...top5.map((c) => ({
      name: c.champion_name,
      value: metric === 'fights' ? c.fight_count : c.total_kos,
    })),
    ...(othersValue > 0 ? [{ name: stat.others, value: othersValue }] : []),
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
        <ResponsiveContainer width='100%' height={260}>
          <PieChart>
            <Pie data={chartData} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={100}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>
        </ResponsiveContainer>
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
