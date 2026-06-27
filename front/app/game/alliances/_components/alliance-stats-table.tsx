'use client';

import { useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, LogOut } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { PlayerSeasonStats } from '@/app/services/statistics';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type SortField =
  | 'total_fights_weighted'
  | 'total_kos'
  | 'total_miniboss'
  | 'total_boss'
  | 'total_not_fought'
  | 'ratio'
  | 'score'
  | 'wars_participated'
  | 'avg_fights_per_war'
  | 'avg_boss_miniboss_per_war'
  | 'total_assists';

export type SortDir = 'asc' | 'desc';

interface SortableHeadProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}

function StatCell({
  value,
  suffix,
  className,
  decimals,
  dataCy,
}: Readonly<{
  value: number;
  suffix?: string;
  className?: string;
  decimals?: number;
  dataCy?: string;
}>) {
  return (
    <TableCell className={`py-1.5 text-right ${className ?? ''}`} data-cy={dataCy}>
      {decimals !== undefined ? value.toFixed(decimals) : value}
      {suffix}
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

const GREEN = ['text-emerald-400 font-semibold', 'text-emerald-400/60', 'text-emerald-400/35'];
const RED = ['text-red-400 font-semibold', 'text-red-400/60', 'text-red-400/35'];

interface AllianceStatsTableProps {
  rows: PlayerSeasonStats[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  selectedId: string | null;
  onRowClick: (id: string) => void;
}

export function AllianceStatsTable({
  rows,
  sortField,
  sortDir,
  onSort,
  selectedId,
  onRowClick,
}: Readonly<AllianceStatsTableProps>) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const colRanks = useMemo(() => {
    const top3 = (values: number[], descending: boolean): Map<number, number> => {
      const sorted = [...new Set(values)].sort((a, b) => (descending ? b - a : a - b));
      return new Map(sorted.slice(0, 3).map((v, i) => [v, i]));
    };
    return {
      total_fights_weighted: top3(rows.map((r) => r.total_fights_weighted), true),
      total_kos: top3(rows.map((r) => r.total_kos), true),
      total_miniboss: top3(rows.map((r) => r.total_miniboss), true),
      total_boss: top3(rows.map((r) => r.total_boss), true),
      total_not_fought: top3(rows.map((r) => r.total_not_fought), true),
      ratio: top3(rows.map((r) => r.ratio), true),
      score: top3(rows.map((r) => r.score), true),
      wars_participated: top3(rows.map((r) => r.wars_participated), true),
      avg_fights_per_war: top3(rows.map((r) => r.avg_fights_per_war), true),
      avg_boss_miniboss_per_war: top3(rows.map((r) => r.avg_boss_miniboss_per_war), true),
      total_assists: top3(rows.map((r) => r.total_assists), true),
    };
  }, [rows]);

  const cellClass = (field: keyof typeof colRanks, value: number, invert = false) => {
    if (value === 0) return '';
    const rank = colRanks[field].get(value);
    if (rank === undefined) return '';
    return (invert ? RED : GREEN)[rank];
  };

  return (
    <Table data-cy='statistics-table'>
      <TableHeader>
        <TableRow>
          <TableHead>{stat.columns.player}</TableHead>
          <TableHead className='text-right'>{stat.columns.group}</TableHead>
          <SortableHead label={stat.columns.ratio} field='ratio' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.kos} field='total_kos' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.avgFights} field='avg_fights_per_war' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.avgBossMiniboss} field='avg_boss_miniboss_per_war' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.fights} field='total_fights_weighted' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.assists} field='total_assists' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.miniboss} field='total_miniboss' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.boss} field='total_boss' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.warsParticipated} field='wars_participated' sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHead label={stat.columns.notFought} field='total_not_fought' sortField={sortField} sortDir={sortDir} onSort={onSort} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isSelected = row.id === selectedId;
          return (
            <TableRow
              key={row.id}
              className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
              onClick={() => onRowClick(row.id)}
              data-cy={`statistics-row-${row.id}`}
            >
              <TableCell className='py-1.5 font-medium'>
                <span className={`flex items-center gap-1 ${!row.is_current_member ? 'text-muted-foreground' : ''}`}>
                  {row.game_pseudo}
                  {!row.is_current_member && <LogOut data-cy={`former-badge-${row.id}`} className='h-3.5 w-3.5 shrink-0' />}
                </span>
              </TableCell>
              <TableCell className='py-1.5 text-right text-muted-foreground'>{row.alliance_group ?? '—'}</TableCell>
              <StatCell value={row.ratio} suffix='%' className={cellClass('ratio', row.ratio)} />
              <StatCell value={row.total_kos} className={cellClass('total_kos', row.total_kos, true)} />
              <StatCell value={row.avg_fights_per_war} decimals={1} className={cellClass('avg_fights_per_war', row.avg_fights_per_war)} />
              <StatCell value={row.avg_boss_miniboss_per_war} decimals={1} className={cellClass('avg_boss_miniboss_per_war', row.avg_boss_miniboss_per_war)} />
              <StatCell value={row.total_fights_weighted} decimals={1} className={cellClass('total_fights_weighted', row.total_fights_weighted)} dataCy={`stat-fights-weighted-${row.id}`} />
              <StatCell value={row.total_assists} className={cellClass('total_assists', row.total_assists)} />
              <StatCell value={row.total_miniboss} className={cellClass('total_miniboss', row.total_miniboss)} />
              <StatCell value={row.total_boss} className={cellClass('total_boss', row.total_boss)} />
              <StatCell value={row.wars_participated} className={cellClass('wars_participated', row.wars_participated)} />
              <StatCell value={row.total_not_fought} className={cellClass('total_not_fought', row.total_not_fought, true)} />
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
