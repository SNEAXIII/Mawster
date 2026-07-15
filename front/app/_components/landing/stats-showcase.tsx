'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AllianceRankingChart from '@/app/game/alliances/_components/alliance-ranking-chart'
import {
  AllianceStatsTable,
  type SortField,
  type SortDir,
} from '@/app/game/alliances/_components/alliance-stats-table'
import { MemberChampionChart } from '@/app/components/statistics/member-champion-chart'
import {
  MOCK_SEASON_STATS,
  MOCK_CHAMPION_USAGE,
  MOCK_RANKING_POINTS,
  MOCK_RANKING_SEASON,
} from './stats-mock-data'

const noop = () => {}

export function StatsShowcase() {
  const { t } = useI18n()
  const s = t.landing.statsShowcase

  const [sortField, setSortField] = useState<SortField>('ratio')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedRows = useMemo(
    () =>
      [...MOCK_SEASON_STATS].sort((a, b) => {
        const av = a[sortField] as number
        const bv = b[sortField] as number
        return sortDir === 'asc' ? av - bv : bv - av
      }),
    [sortField, sortDir]
  )

  return (
    <section
      className='px-6 py-12 md:px-12'
      data-cy='landing-stats-showcase'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='flex flex-wrap items-center gap-3'>
          <p className='text-sm font-medium uppercase tracking-wider text-brand'>{s.eyebrow}</p>
          <span className='rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-500'>
            {s.demoBadge}
          </span>
        </div>
        <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{s.title}</h2>
        <p className='mt-4 max-w-2xl leading-relaxed text-muted-foreground'>{s.subtitle}</p>

        {/* Preview built from the real in-app components. Controls are wired to
            no-op handlers so the board stays static, but scrolling and chart
            tooltips remain usable. */}
        <div className='mt-10 flex flex-col gap-6 select-none'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>{s.rankingTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <AllianceRankingChart
                points={MOCK_RANKING_POINTS}
                seasonNumber={MOCK_RANKING_SEASON}
              />
            </CardContent>
          </Card>

          <div className='flex flex-col gap-6 lg:flex-row'>
            <Card className='flex-1 min-w-0'>
              <CardContent className='overflow-x-auto pt-6'>
                <AllianceStatsTable
                  rows={sortedRows}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  selectedId={null}
                  onRowClick={noop}
                />
              </CardContent>
            </Card>

            <div className='w-full shrink-0 lg:w-80'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{t.game.alliances.statistics.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberChampionChart
                    data={MOCK_CHAMPION_USAGE}
                    metric='deathless'
                    onMetricChange={noop}
                    perspective='attacker'
                    onPerspectiveChange={noop}
                    onViewDetail={noop}
                    loading={false}
                    playerName={null}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
