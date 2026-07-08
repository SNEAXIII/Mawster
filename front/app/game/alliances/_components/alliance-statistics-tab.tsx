'use client';

import { useMemo, useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import type { RankingHistoryPoint, SeasonStatus } from '@/app/services/game';
import { fetchAllianceRankingHistory } from '@/app/services/game';
import AllianceRankingChart from './alliance-ranking-chart';
import type { PlayerSeasonStats } from '@/app/services/statistics';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector';
import AllianceSelect from '@/app/game/_components/alliance-select';
import { AllianceStatsTable, type SortField, type SortDir } from './alliance-stats-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/collapsible-section';
import { MemberChampionChart } from '@/app/components/statistics/member-champion-chart';
import { ChampionDetailModal } from '@/app/components/statistics/champion-detail-modal';
import { useChampionStats } from './use-champion-stats';

interface AllianceStatisticsTabProps {
  alliances: AllianceWithVisitorFlag[];
  selectedAllianceId: string;
  onAllianceChange: (allianceId: string) => void;
  seasonStats: PlayerSeasonStats[];
  statsLoading: boolean;
  statsError: string;
  onRetry: () => Promise<void>;
}

type MemberFilter = 'current' | 'all' | 'former';

const RATIO_OPTIONS = [-Infinity, 0, 50, 60, 70, 80, 90];

function toGroupValue(group: number | null): string {
  return group === null ? 'none' : String(group);
}

export default function AllianceStatisticsTab({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  seasonStats,
  statsLoading,
  statsError,
  onRetry,
}: Readonly<AllianceStatisticsTabProps>) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;
  const [ratioMin, setRatioMin] = useState(-Infinity);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [rankingPoints, setRankingPoints] = useState<RankingHistoryPoint[]>([]);
  const [rankingSeasonNumber, setRankingSeasonNumber] = useState<number | null>(null);
  const [rankingSeasonStatus, setRankingSeasonStatus] = useState<SeasonStatus | null>(null);

  useEffect(() => {
    if (!selectedAllianceId) return;
    setRankingPoints([]);
    setRankingSeasonNumber(null);
    setRankingSeasonStatus(null);
    fetchAllianceRankingHistory(selectedAllianceId)
      .then((data) => {
        setRankingPoints(data.points);
        setRankingSeasonNumber(data.season_number);
        setRankingSeasonStatus(data.season_status);
      })
      .catch(() => {});
  }, [selectedAllianceId]);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('current');
  const [sortField, setSortField] = useState<SortField>('ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const {
    selectedGameAccountId,
    setSelectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage,
    chartMetric,
    setChartMetric,
    chartPerspective,
    setChartPerspective,
    detailOpen,
    setDetailOpen,
    wars,
    chartLoading,
    handleRowClick,
  } = useChampionStats(selectedAllianceId, selectedGroup);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const availableGroups = useMemo(
    () =>
      Array.from(new Set(seasonStats.map((row) => toGroupValue(row.alliance_group)))).sort(
        (a, b) => {
          if (a === 'none') return 1;
          if (b === 'none') return -1;
          return Number(a) - Number(b);
        }
      ),
    [seasonStats]
  );

  const filteredStats = useMemo(() => {
    let rows = seasonStats;
    if (memberFilter === 'current') rows = rows.filter((r) => r.is_current_member);
    if (memberFilter === 'former') rows = rows.filter((r) => !r.is_current_member);
    if (ratioMin !== -Infinity) rows = rows.filter((r) => r.ratio >= ratioMin);
    if (selectedGroup !== 'all') {
      rows = rows.filter((r) => toGroupValue(r.alliance_group) === selectedGroup);
    }
    return [...rows].sort((a, b) => {
      const av = a[sortField as keyof typeof a] as number;
      const bv = b[sortField as keyof typeof b] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [seasonStats, memberFilter, ratioMin, selectedGroup, sortField, sortDir]);

  const selectedPlayer = useMemo(
    () => seasonStats.find((s) => s.id === selectedGameAccountId) ?? null,
    [seasonStats, selectedGameAccountId]
  );

  const hasFilters =
    memberFilter !== 'current' ||
    selectedGroup !== 'all' ||
    ratioMin !== -Infinity ||
    sortField !== 'ratio' ||
    sortDir !== 'desc' ||
    selectedGameAccountId !== null ||
    selectedWarId !== null;

  return (
    <div className='flex flex-col gap-4'>
      {rankingSeasonStatus === 'ended' && rankingSeasonNumber !== null && (
        <span
          data-cy='statistics-season-badge'
          className='self-start rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground'
        >
          {stat.seasonBadgeEnded.replace('{number}', String(rankingSeasonNumber))}
        </span>
      )}
      {alliances.length > 1 && (
        <AllianceSelect
          alliances={alliances}
          value={selectedAllianceId}
          onChange={onAllianceChange}
          dataCy='statistics-alliance-select'
        />
      )}

      <CollapsibleSection title={t.game.alliances.rankingHistory} defaultOpen={false}>
        <AllianceRankingChart points={rankingPoints} seasonNumber={rankingSeasonNumber} />
      </CollapsibleSection>

      {statsLoading ? (
        <p className='text-sm text-muted-foreground py-6 text-center'>{stat.loading}</p>
      ) : statsError ? (
        <div className='flex flex-col items-center gap-2 py-6'>
          <p className='text-sm text-destructive'>{statsError}</p>
          <Button size='sm' variant='outline' onClick={onRetry}>{stat.retry}</Button>
        </div>
      ) : seasonStats.length === 0 ? (
        <p className='text-sm text-muted-foreground py-6 text-center' data-cy='statistics-empty'>{stat.empty}</p>
      ) : (
        <>
          <div className='flex flex-wrap items-center gap-3'>
            <Select
              value={memberFilter}
              onValueChange={(v) => setMemberFilter(v as MemberFilter)}
            >
              <SelectTrigger
                className='w-44'
                data-cy='statistics-member-filter'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='current'>{stat.memberFilter.current}</SelectItem>
                <SelectItem value='all'>{stat.memberFilter.all}</SelectItem>
                <SelectItem value='former'>{stat.memberFilter.former}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedWarId ?? 'all'}
              onValueChange={(v) => setSelectedWarId(v === 'all' ? null : v)}
            >
              <SelectTrigger
                className='w-44'
                data-cy='statistics-war-filter'
              >
                <SelectValue placeholder={stat.allWars} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value='all'
                  data-cy='statistics-war-all'
                >
                  {stat.allWars}
                </SelectItem>
                {wars.map((w) => (
                  <SelectItem
                    key={w.id}
                    value={w.id}
                    data-cy={`statistics-war-${w.id}`}
                  >
                    {w.opponent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableGroups.length > 1 && (
              <Select
                value={selectedGroup}
                onValueChange={setSelectedGroup}
              >
                <SelectTrigger
                  className='w-28'
                  data-cy='statistics-group-filter'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>{stat.allGroups}</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem
                      key={g}
                      value={g}
                      data-cy={`statistics-group-option-${g}`}
                    >
                      {g === 'none' ? stat.noGroup : `G${g}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={String(ratioMin)}
              onValueChange={(v) => setRatioMin(Number(v))}
            >
              <SelectTrigger
                className='w-44'
                data-cy='statistics-ratio-filter'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIO_OPTIONS.map((value) => (
                  <SelectItem
                    key={value === -Infinity ? 'all' : value}
                    value={String(value)}
                    data-cy={`statistics-ratio-option-${value === -Infinity ? 'all' : value}`}
                  >
                    {value === -Infinity ? stat.ratioAll : `${stat.ratioMin} ≥ ${value}%`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setMemberFilter('current');
                  setRatioMin(-Infinity);
                  setSelectedGroup('all');
                  setSortField('ratio');
                  setSortDir('desc');
                  setSelectedGameAccountId(null);
                  setSelectedWarId(null);
                }}
                data-cy='statistics-reset-filters'
              >
                {stat.resetFilters}
              </Button>
            )}
          </div>

          <div className='flex flex-col lg:flex-row gap-6'>
            <div className='flex-1 min-w-0'>
              {filteredStats.length === 0 ? (
                <p className='text-sm text-muted-foreground py-4 text-center' data-cy='statistics-empty-filtered'>
                  {stat.noFilteredResults}
                </p>
              ) : (
                <AllianceStatsTable
                  rows={filteredStats}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  selectedId={selectedGameAccountId}
                  onRowClick={handleRowClick}
                />
              )}
            </div>

            <div className='w-full lg:w-80 shrink-0'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{stat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberChampionChart
                    data={championUsage}
                    metric={chartMetric}
                    onMetricChange={setChartMetric}
                    perspective={chartPerspective}
                    onPerspectiveChange={setChartPerspective}
                    onViewDetail={() => setDetailOpen(true)}
                    loading={chartLoading}
                    playerName={selectedPlayer?.game_pseudo ?? null}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <ChampionDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={championUsage}
        metric={chartMetric}
        playerName={selectedPlayer?.game_pseudo ?? null}
      />
    </div>
  );
}
