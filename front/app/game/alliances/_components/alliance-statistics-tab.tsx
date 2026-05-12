'use client';

import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { Alliance } from '@/app/services/game';
import type { PlayerSeasonStats } from '@/app/services/statistics';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberChampionChart } from './member-champion-chart';
import { ChampionDetailModal } from './champion-detail-modal';
import { useChampionStats } from './use-champion-stats';

interface AllianceStatisticsTabProps {
  alliances: Alliance[];
  selectedAllianceId: string;
  onAllianceChange: (allianceId: string) => void;
  seasonStats: PlayerSeasonStats[];
  statsLoading: boolean;
  statsError: string;
  onRetry: () => Promise<void>;
}

type SortField =
  | 'total_fights'
  | 'total_kos'
  | 'total_miniboss'
  | 'total_boss'
  | 'total_not_fought'
  | 'ratio'
  | 'score';
type SortDir = 'asc' | 'desc';

const RATIO_OPTIONS = [-Infinity, 0, 50, 60, 70, 80, 90];

function toGroupValue(group: number | null): string {
  return group === null ? 'none' : String(group);
}

interface SortableHeadProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}

function StatCell({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  return (
    <TableCell className={`py-1.5 text-right ${className ?? ''}`}>
      {value}{suffix}
    </TableCell>
  );
}

function SortableHead({ label, field, sortField, sortDir, onSort }: Readonly<SortableHeadProps>) {
  const active = sortField === field;
  const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead className='text-right'>
      <button
        type='button'
        onClick={() => onSort(field)}
        className='inline-flex items-center justify-end gap-1 w-full hover:text-foreground transition-colors'
      >
        {label}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-foreground' : 'opacity-40'}`} />
      </button>
    </TableHead>
  );
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
  const [sortField, setSortField] = useState<SortField>('ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const {
    selectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage,
    chartMetric,
    setChartMetric,
    detailOpen,
    setDetailOpen,
    wars,
    chartLoading,
    handleRowClick,
  } = useChampionStats(selectedAllianceId);

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
        },
      ),
    [seasonStats],
  );

  const filteredStats = useMemo(() => {
    let rows = seasonStats;
    if (ratioMin !== -Infinity) rows = rows.filter((r) => r.ratio >= ratioMin);
    if (selectedGroup !== 'all') {
      rows = rows.filter((r) => toGroupValue(r.alliance_group) === selectedGroup);
    }
    return [...rows].sort((a, b) => {
      const av = a[sortField as keyof typeof a] as number;
      const bv = b[sortField as keyof typeof b] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [seasonStats, ratioMin, selectedGroup, sortField, sortDir]);

  const colRanks = useMemo(() => {
    const top3 = (values: number[], descending: boolean): Map<number, number> => {
      const sorted = [...new Set(values)].sort((a, b) => (descending ? b - a : a - b));
      return new Map(sorted.slice(0, 3).map((v, i) => [v, i]));
    };
    const f = filteredStats;
    return {
      total_fights: top3(f.map((r) => r.total_fights), true),
      total_kos: top3(f.map((r) => r.total_kos), true),
      total_miniboss: top3(f.map((r) => r.total_miniboss), true),
      total_boss: top3(f.map((r) => r.total_boss), true),
      total_not_fought: top3(f.map((r) => r.total_not_fought), true),
      ratio: top3(f.map((r) => r.ratio), true),
      score: top3(f.map((r) => r.score), true),
    };
  }, [filteredStats]);

  const GREEN = ['text-emerald-400 font-semibold', 'text-emerald-400/60', 'text-emerald-400/35'];
  const RED = ['text-red-400 font-semibold', 'text-red-400/60', 'text-red-400/35'];

  const cellClass = (field: keyof typeof colRanks, value: number, invert = false) => {
    if (value === 0) return '';
    const rank = colRanks[field].get(value);
    if (rank === undefined) return '';
    return (invert ? RED : GREEN)[rank];
  };

  const selectedPlayer = useMemo(
    () => seasonStats.find((s) => s.id === selectedGameAccountId) ?? null,
    [seasonStats, selectedGameAccountId],
  );

  const hasFilters =
    selectedGroup !== 'all' || ratioMin !== -Infinity || sortField !== 'ratio' || sortDir !== 'desc';

  if (statsLoading) {
    return <p className='text-sm text-muted-foreground py-6 text-center'>{stat.loading}</p>;
  }
  if (statsError) {
    return (
      <div className='flex flex-col items-center gap-2 py-6'>
        <p className='text-sm text-destructive'>{statsError}</p>
        <Button size='sm' variant='outline' onClick={onRetry}>{stat.retry}</Button>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {alliances.length > 1 && (
        <Select value={selectedAllianceId} onValueChange={onAllianceChange}>
          <SelectTrigger className='w-52' data-cy='statistics-alliance-select'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {alliances.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {seasonStats.length === 0 ? (
        <p className='text-sm text-muted-foreground py-6 text-center'>{stat.empty}</p>
      ) : (
        <>
          <div className='flex flex-wrap items-center gap-3'>
            <Select
              value={selectedWarId ?? 'all'}
              onValueChange={(v) => setSelectedWarId(v === 'all' ? null : v)}
            >
              <SelectTrigger className='w-44' data-cy='statistics-war-filter'>
                <SelectValue placeholder={stat.allWars} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all' data-cy='statistics-war-all'>{stat.allWars}</SelectItem>
                {wars.map((w) => (
                  <SelectItem key={w.id} value={w.id} data-cy={`statistics-war-${w.id}`}>
                    {w.opponent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(ratioMin)}
              onValueChange={(v) => setRatioMin(Number(v))}
            >
              <SelectTrigger className='w-44' data-cy='statistics-ratio-filter'>
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

            {availableGroups.length > 1 && (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className='w-36' data-cy='statistics-group-filter'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>{stat.allGroups}</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === 'none' ? stat.noGroup : `G${g}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setRatioMin(-Infinity);
                  setSelectedGroup('all');
                  setSortField('ratio');
                  setSortDir('desc');
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
                <p className='text-sm text-muted-foreground py-4 text-center'>
                  {stat.noFilteredResults}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{stat.columns.player}</TableHead>
                      <TableHead className='text-right'>{stat.columns.group}</TableHead>
                      <SortableHead label={stat.columns.fights} field='total_fights' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.kos} field='total_kos' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.miniboss} field='total_miniboss' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.boss} field='total_boss' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.notFought} field='total_not_fought' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.ratio} field='ratio' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                      <SortableHead label={stat.columns.score} field='score' sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.map((row) => {
                      const isSelected = row.id === selectedGameAccountId;
                      return (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
                          onClick={() => handleRowClick(row.id)}
                          data-cy={`statistics-row-${row.id}`}
                        >
                          <TableCell className='py-1.5 font-medium'>{row.game_pseudo}</TableCell>
                          <TableCell className='py-1.5 text-right text-muted-foreground'>
                            {row.alliance_group ?? '—'}
                          </TableCell>
                          <StatCell value={row.total_fights} className={cellClass('total_fights', row.total_fights)} />
                          <StatCell value={row.total_kos} className={cellClass('total_kos', row.total_kos, true)} />
                          <StatCell value={row.total_miniboss} className={cellClass('total_miniboss', row.total_miniboss)} />
                          <StatCell value={row.total_boss} className={cellClass('total_boss', row.total_boss)} />
                          <StatCell value={row.total_not_fought} className={cellClass('total_not_fought', row.total_not_fought, true)} />
                          <StatCell value={row.ratio} suffix='%' className={cellClass('ratio', row.ratio)} />
                          <StatCell value={row.score} className={cellClass('score', row.score)} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
