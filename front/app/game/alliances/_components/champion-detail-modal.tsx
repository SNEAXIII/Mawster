'use client';

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

interface ChampionDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: ChampionUsageItem[];
  metric: 'fights' | 'kos';
  playerName: string | null;
}

export function ChampionDetailModal({
  open,
  onClose,
  data,
  metric,
  playerName,
}: ChampionDetailModalProps) {
  const { t } = useI18n();
  const stat = t.game.alliances.statistics;

  const sorted = [...data].sort((a, b) =>
    metric === 'fights' ? b.fight_count - a.fight_count : b.total_kos - a.total_kos,
  );

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
              <TableHead>{stat.champion}</TableHead>
              <TableHead className='text-right'>{stat.columns.fights}</TableHead>
              <TableHead className='text-right'>{stat.columns.kos}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.champion_id}>
                <TableCell>{c.champion_name}</TableCell>
                <TableCell className='text-right'>{c.fight_count}</TableCell>
                <TableCell className='text-right'>{c.total_kos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
