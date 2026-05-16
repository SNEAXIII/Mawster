'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { useI18n } from '@/app/i18n';
import type { RankingHistoryPoint } from '@/app/services/game';

interface AllianceRankingChartProps {
  points: RankingHistoryPoint[];
  seasonNumber: number | null;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: RankingHistoryPoint;
}

function WinLossDot({ cx = 0, cy = 0, payload }: CustomDotProps) {
  const color =
    payload?.win === true ? '#22c55e' : payload?.win === false ? '#ef4444' : '#94a3b8';
  return <Dot cx={cx} cy={cy} r={5} fill={color} stroke='none' />;
}

interface TooltipPayloadItem {
  payload: RankingHistoryPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className='bg-popover border rounded-md p-2 text-xs shadow-md space-y-0.5'>
      <p className='font-semibold text-foreground'>{point.opponent_name}</p>
      <p className='text-muted-foreground'>
        {t.game.alliances.elo}: <span className='text-foreground font-medium'>{point.elo_after}</span>
      </p>
      {point.tier !== null && (
        <p className='text-muted-foreground'>
          {t.game.alliances.tier}: <span className='text-foreground font-medium'>{point.tier}</span>
        </p>
      )}
      {point.win !== null && (
        <p className={point.win ? 'text-green-500' : 'text-red-500'}>
          {point.win ? 'Win' : 'Loss'}
        </p>
      )}
    </div>
  );
}

const chartConfig = { elo_after: { label: 'ELO' } };

export default function AllianceRankingChart({ points, seasonNumber }: Readonly<AllianceRankingChartProps>) {
  const { t } = useI18n();

  if (points.length === 0) {
    return (
      <p className='text-xs text-muted-foreground italic py-2' data-cy='ranking-history-empty'>
        {t.game.alliances.noWarsThisSeason}
        {seasonNumber !== null && ` (${t.game.alliances.season} ${seasonNumber})`}
      </p>
    );
  }

  return (
    <div className='space-y-1' data-cy='ranking-history-chart'>
      {seasonNumber !== null && (
        <p className='text-xs text-muted-foreground'>
          {t.game.alliances.season} {seasonNumber}
        </p>
      )}
      <ChartContainer config={chartConfig} className='h-40 w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
            <XAxis
              dataKey='war_number'
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type='monotone'
              dataKey='elo_after'
              stroke='hsl(var(--primary))'
              strokeWidth={2}
              dot={<WinLossDot />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
