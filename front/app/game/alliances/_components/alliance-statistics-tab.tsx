'use client';

import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { Alliance } from '@/app/services/game';
import type { PlayerSeasonStats } from '@/app/services/statistics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AllianceStatisticsTabProps {
  alliances: Alliance[];
  selectedAllianceId: string;
  onAllianceChange: (allianceId: string) => void;
  seasonStats: PlayerSeasonStats[];
  statsLoading: boolean;
  statsError: string;
  onRetry: () => Promise<void>;
}

type SortField = 'total_fights' | 'total_kos' | 'total_miniboss' | 'total_boss' | 'ratio' | 'ratio_mb';
type SortDir = 'asc' | 'desc';

const RATIO_OPTIONS = [0, 50, 60, 70, 80, 90];

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

function SortableHead({ label, field, sortField, sortDir, onSort }: SortableHeadProps) {
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
  const [ratioMin, setRatioMin] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [sortField, setSortField] = useState<SortField>('ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
    const mult = sortDir === 'asc' ? 1 : -1;
    return seasonStats
      .filter((row) => row.ratio >= ratioMin)
      .filter((row) => selectedGroup === 'all' || toGroupValue(row.alliance_group) === selectedGroup)
      .sort((a, b) => {
        const diff = a[sortField] - b[sortField];
        return diff !== 0 ? diff * mult : a.game_pseudo.localeCompare(b.game_pseudo);
      });
  }, [seasonStats, ratioMin, selectedGroup, sortField, sortDir]);

  const getGroupLabel = (group: number | null) =>
    group === null ? t.game.alliances.statistics.noGroup : `G${group}`;

  const sortHeadProps = { sortField, sortDir, onSort: toggleSort };

  return (
    <Card data-cy='alliance-statistics-tab'>
      <CardHeader className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <CardTitle>{t.game.alliances.statistics.title}</CardTitle>
          {alliances.length > 1 && (
            <Select value={selectedAllianceId || undefined} onValueChange={onAllianceChange}>
              <SelectTrigger className='w-56' data-cy='statistics-alliance-select'>
                <SelectValue placeholder={t.game.alliances.statistics.alliance} />
              </SelectTrigger>
              <SelectContent>
                {alliances.map((alliance) => (
                  <SelectItem key={alliance.id} value={alliance.id}>
                    [{alliance.tag}] {alliance.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <CardDescription>{t.game.alliances.statistics.description}</CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        {statsLoading && (
          <p className='text-sm text-muted-foreground'>{t.game.alliances.statistics.loading}</p>
        )}

        {!statsLoading && statsError && (
          <div className='rounded-lg border border-destructive/40 p-3' data-cy='statistics-error'>
            <p className='text-sm text-destructive'>{statsError}</p>
            <Button
              type='button'
              variant='outline'
              onClick={() => void onRetry()}
              className='mt-2'
              data-cy='statistics-retry'
            >
              {t.game.alliances.statistics.retry}
            </Button>
          </div>
        )}

        {!statsLoading && !statsError && seasonStats.length === 0 && (
          <p className='text-sm text-muted-foreground' data-cy='statistics-empty'>
            {t.game.alliances.statistics.empty}
          </p>
        )}

        {!statsLoading && !statsError && seasonStats.length > 0 && (
          <>
            <div className='flex flex-wrap items-center gap-3'>
              <Select
                value={String(ratioMin)}
                onValueChange={(v) => setRatioMin(Number(v))}
                data-cy='statistics-ratio-filter'
              >
                <SelectTrigger className='w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATIO_OPTIONS.map((value) => (
                    <SelectItem key={value} value={String(value)} data-cy={`statistics-ratio-option-${value}`}>
                      {t.game.alliances.statistics.ratioMin} ≥ {value}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(selectedGroup !== 'all' || ratioMin !== 0 || sortField !== 'ratio' || sortDir !== 'desc') && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => { setRatioMin(0); setSelectedGroup('all'); setSortField('ratio'); setSortDir('desc'); }}
                  data-cy='statistics-reset-filters'
                >
                  {t.game.alliances.statistics.resetFilters}
                </Button>
              )}
            </div>

            {filteredStats.length === 0 ? (
              <p className='text-sm text-muted-foreground' data-cy='statistics-empty-filtered'>
                {t.game.alliances.statistics.noFilteredResults}
              </p>
            ) : (
              <Table data-cy='statistics-table'>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.game.alliances.statistics.columns.player}</TableHead>
                    <TableHead>
                      <Select
                        value={selectedGroup}
                        onValueChange={setSelectedGroup}
                        data-cy='statistics-group-filter'
                      >
                        <SelectTrigger className='h-auto border-none bg-transparent p-0 shadow-none gap-1 font-medium text-muted-foreground hover:text-foreground focus:ring-0 focus-visible:ring-0 w-auto [&>svg:last-child]:hidden'>
                          <SelectValue />
                          <ChevronDown className='h-3.5 w-3.5 opacity-70 shrink-0' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>{t.game.alliances.statistics.allGroups}</SelectItem>
                          {availableGroups.map((groupValue) => (
                            <SelectItem key={groupValue} value={groupValue} data-cy={`statistics-group-option-${groupValue}`}>
                              {groupValue === 'none' ? t.game.alliances.statistics.noGroup : `G${groupValue}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <SortableHead label={t.game.alliances.statistics.columns.fights} field='total_fights' {...sortHeadProps} />
                    <SortableHead label={t.game.alliances.statistics.columns.kos} field='total_kos' {...sortHeadProps} />
                    <SortableHead label={t.game.alliances.statistics.columns.miniboss} field='total_miniboss' {...sortHeadProps} />
                    <SortableHead label={t.game.alliances.statistics.columns.boss} field='total_boss' {...sortHeadProps} />
                    <SortableHead label={t.game.alliances.statistics.columns.ratio} field='ratio' {...sortHeadProps} />
                    <SortableHead label={t.game.alliances.statistics.columns.ratioMb} field='ratio_mb' {...sortHeadProps} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.map((row, i) => (
                    <TableRow
                      key={row.id}
                      data-cy={`statistics-row-${row.id}`}
                      className={
                        i === 0 ? 'bg-yellow-500/10 hover:bg-yellow-500/15' :
                        i === 1 ? 'bg-slate-400/10 hover:bg-slate-400/15' :
                        i === 2 ? 'bg-orange-600/10 hover:bg-orange-600/15' :
                        undefined
                      }
                    >
                      <TableCell className='font-medium'>
                        <span className={
                          i === 0 ? 'text-yellow-500' :
                          i === 1 ? 'text-slate-400' :
                          i === 2 ? 'text-orange-600' :
                          undefined
                        }>
                          {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
                        </span>
                        {row.game_pseudo}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{getGroupLabel(row.alliance_group)}</Badge>
                      </TableCell>
                      <TableCell className='text-right'>{row.total_fights}</TableCell>
                      <TableCell className='text-right'>{row.total_kos}</TableCell>
                      <TableCell className='text-right'>{row.total_miniboss}</TableCell>
                      <TableCell className='text-right'>{row.total_boss}</TableCell>
                      <TableCell className='text-right'>{row.ratio}%</TableCell>
                      <TableCell className='text-right'>{row.ratio_mb}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
