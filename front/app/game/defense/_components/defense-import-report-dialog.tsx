'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { DefenseImportReport, DefenseReportItem } from '@/app/services/defense';
import { CheckCircle, XCircle, ArrowRight, Minus } from 'lucide-react';
import ChampionPortrait from '@/components/champion-portrait';
import { shortenChampionName, getClassColors, RARITY_LABELS } from '@/app/services/roster';

interface Props {
  open: boolean;
  onClose: () => void;
  report: DefenseImportReport | null;
}

const MAX_NODE = 50;

function getNodeRowClass(
  before: DefenseReportItem | undefined,
  after: DefenseReportItem | undefined,
  error: string | undefined
): string {
  if (error) return 'bg-red-50 dark:bg-red-950/30';
  if (!before && after) return 'bg-green-50 dark:bg-green-950/30';
  if (before && !after) return 'bg-red-50/50 dark:bg-red-900/20';
  if (!before || !after) return '';

  const unchanged =
    before.champion_name === after.champion_name &&
    before.rarity === after.rarity &&
    before.owner_name === after.owner_name;

  return unchanged ? '' : 'bg-blue-50 dark:bg-blue-950/30';
}

function AfterCell({
  after,
  error,
  emptyLabel: _emptyLabel,
  removedLabel,
}: Readonly<{
  after: DefenseReportItem | undefined;
  error: string | undefined;
  emptyLabel: string;
  removedLabel: string;
}>) {
  if (after) return <NodeChampion item={after} />;
  if (error) {
    return (
      <span
        className='text-xs text-destructive truncate'
        title={error}
      >
        <XCircle className='w-3 h-3 inline mr-0.5' />
        {error}
      </span>
    );
  }
  return (
    <span className='text-xs text-muted-foreground italic'>
      <Minus className='w-3 h-3 inline mr-0.5' />
      {removedLabel}
    </span>
  );
}

export default function DefenseImportReportDialog({ open, onClose, report }: Readonly<Props>) {
  const { t } = useI18n();
  if (!report) return null;

  const ti = t.game.defense.importExport;

  // Build lookup maps by node_number
  const beforeMap = new Map<number, DefenseReportItem>();
  for (const p of report.before) beforeMap.set(p.node_number, p);

  const afterMap = new Map<number, DefenseReportItem>();
  for (const p of report.after) afterMap.set(p.node_number, p);

  const errorMap = new Map<number, string>();
  for (const e of report.errors) errorMap.set(e.node_number, e.reason);

  // Build node list 50→1
  const nodes: number[] = [];
  for (let n = MAX_NODE; n >= 1; n--) nodes.push(n);

  // Only show nodes that had something before, after, or errored
  const activeNodes = nodes.filter((n) => beforeMap.has(n) || afterMap.has(n) || errorMap.has(n));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>{ti.reportTitle}</DialogTitle>
          <DialogDescription className='flex items-center gap-3 mt-1 flex-wrap'>
            <span className='inline-flex items-center gap-1 text-green-600 font-medium'>
              <CheckCircle className='w-3.5 h-3.5' /> {report.success_count} {ti.placed}
            </span>
            {report.error_count > 0 && (
              <span className='inline-flex items-center gap-1 text-red-600 font-medium'>
                <XCircle className='w-3.5 h-3.5' /> {report.error_count} {ti.errors}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700'>
          {activeNodes.map((node) => {
            const before = beforeMap.get(node);
            const after = afterMap.get(node);
            const error = errorMap.get(node);

            return (
              <div
                key={node}
                className={`py-2 px-2 flex items-center gap-2 ${getNodeRowClass(before, after, error)}`}
              >
                {/* Node number */}
                <span className='shrink-0 w-8 text-center text-xs font-bold text-muted-foreground'>
                  #{node}
                </span>

                {/* Before side */}
                <div className='flex-1 min-w-0'>
                  {before ? (
                    <NodeChampion item={before} />
                  ) : (
                    <span className='text-xs text-muted-foreground italic'>{ti.empty}</span>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className='w-4 h-4 shrink-0 text-muted-foreground' />

                {/* After side */}
                <div className='flex-1 min-w-0'>
                  <AfterCell
                    after={after}
                    error={error}
                    emptyLabel={ti.empty}
                    removedLabel={ti.removed}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact champion cell: portrait 40×40 + name + rarity + owner */
function NodeChampion({ item }: Readonly<{ item: DefenseReportItem }>) {
  const classColors = getClassColors(item.champion_class ?? 'Unknown');

  return (
    <div className='flex items-center gap-2 min-w-0'>
      <div className='shrink-0'>
        <ChampionPortrait
          imageUrl={item.champion_image_url}
          name={item.champion_name}
          rarity={item.rarity}
          size={40}
        />
      </div>
      <div className='min-w-0 flex-1'>
        <p
          className='text-xs font-semibold truncate'
          title={item.champion_name}
        >
          {shortenChampionName(item.champion_name)}
        </p>
        <p className='text-[10px] text-muted-foreground truncate'>
          <span className={classColors.label}>{RARITY_LABELS[item.rarity] ?? item.rarity}</span>
          {' · '}
          {item.owner_name}
        </p>
      </div>
    </div>
  );
}
