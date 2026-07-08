'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/app/i18n';
import type { ChampionUsageItem } from '@/app/services/statistics';
import { getChampionImageUrl } from '@/app/services/champions';

interface ChampionDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: ChampionUsageItem[];
  metric: 'all' | 'kos' | 'deathless';
  playerName: string | null;
}

type SortField = 'fights' | 'kos';

export function ChampionDetailModal({
  open,
  onClose,
  data,
  metric,
  playerName,
}: ChampionDetailModalProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;
  const [sortField, setSortField] = useState<SortField>(metric === 'kos' ? 'kos' : 'fights');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = sortField === 'fights' ? a.fight_count : a.total_kos;
    const bv = sortField === 'fights' ? b.fight_count : b.total_kos;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const SortHead = ({ field, label }: { field: SortField; label: string }) => {
    const active = sortField === field;
    const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <TableHead className='text-right'>
        <button
          type='button'
          onClick={() => toggleSort(field)}
          className='inline-flex items-center justify-end gap-1 w-full hover:text-foreground transition-colors'
        >
          {label}
          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-foreground' : 'opacity-40'}`} />
        </button>
      </TableHead>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-w-lg flex flex-col max-h-[80vh]' data-cy='champion-detail-modal'>
        <DialogHeader>
          <DialogTitle>{playerName ?? stat.allianceView}</DialogTitle>
        </DialogHeader>
        <div className='overflow-y-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8' />
                <TableHead>{stat.champion}</TableHead>
                <SortHead field='fights' label={stat.columns.fights} />
                <SortHead field='kos' label={stat.columns.kos} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => {
                const imgUrl = getChampionImageUrl(c.image_url, 40);
                return (
                  <TableRow key={c.champion_id}>
                    <TableCell className='py-1 pr-0'>
                      {imgUrl ? (
                        <img src={imgUrl} alt={c.champion_name} className='w-7 h-7 rounded object-cover' />
                      ) : (
                        <span className='w-7 h-7 rounded bg-muted block' />
                      )}
                    </TableCell>
                    <TableCell className='py-1'>{c.champion_name}</TableCell>
                    <TableCell className='py-1 text-right'>{c.fight_count}</TableCell>
                    <TableCell className='py-1 text-right'>{c.total_kos}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
