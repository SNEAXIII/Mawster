'use client';

import { useI18n } from '@/app/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { RatioEvolutionPoint } from '@/app/services/player-stats';

interface Props {
  points: RatioEvolutionPoint[];
}

export function ProfileRatioEvolutionChart({ points }: Readonly<Props>) {
  const { t } = useI18n();
  const s = t.profile.statistics;
  const config = {
    fights: { label: s.evolutionFights, color: '#3b82f6' },
    ratio: { label: s.evolutionRatio, color: '#22c55e' },
  };
  return (
    <Card data-cy='profile-evolution-chart'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm'>{s.evolutionTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className='text-sm text-muted-foreground py-6 text-center'>{s.emptySeason}</p>
        ) : (
          <ChartContainer config={config} className='w-full h-64'>
            <ComposedChart data={points}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey='label' tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId='left' domain={[ 0, 10]}tickLine={false} axisLine={false} fontSize={11} allowDecimals={false}/>
              <YAxis
                yAxisId='right'
                orientation='right'
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId='left' dataKey='fights' fill='var(--color-fights)' radius={4} />
              <Line
                yAxisId='right'
                dataKey='ratio'
                stroke='var(--color-ratio)'
                strokeWidth={2}
                dot
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
