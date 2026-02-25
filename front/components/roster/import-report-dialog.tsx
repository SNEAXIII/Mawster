'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { FiCheck, FiX, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ChampionPortrait from '@/components/champion-portrait';
import {
  shortenChampionName,
  getClassColors,
  RARITY_LABELS,
} from '@/app/services/roster';

export interface ImportResult {
  champion_name: string;
  success: boolean;
  isNew: boolean;
  isSkipped: boolean;
  champion_class: string | null;
  image_url: string | null;
  newRarity: string;
  newSignature: number;
  oldRarity: string | null;
  oldSignature: number | null;
  error?: string;
}

interface ImportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ImportResult[];
}

export default function ImportReportDialog({
  open,
  onOpenChange,
  results,
}: ImportReportDialogProps) {
  const { t } = useI18n();

  const addedCount = results.filter((r) => r.success && r.isNew).length;
  const updatedCount = results.filter((r) => r.success && !r.isNew && !r.isSkipped).length;
  const skippedCount = results.filter((r) => r.success && r.isSkipped).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.roster.importExport.reportTitle}</DialogTitle>
          <DialogDescription className="flex items-center gap-3 mt-1 flex-wrap">
            {addedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                <FiCheck size={14} /> {addedCount} {t.roster.importExport.badgeAdded.toLowerCase()}
              </span>
            )}
            {updatedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                <FiCheck size={14} /> {updatedCount} {t.roster.importExport.badgeUpdated.toLowerCase()}
              </span>
            )}
            {skippedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                {skippedCount} {t.roster.importExport.badgeSkipped.toLowerCase()}
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <FiX size={14} /> {failCount} {t.roster.importExport.badgeError.toLowerCase()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2">
          {results.map((result, idx) => {
            const classColors = getClassColors(result.champion_class ?? 'Unknown');
            const hasRarityChange = result.oldRarity !== null && result.oldRarity !== result.newRarity;
            const hasSigChange = result.oldSignature !== null && result.oldSignature !== result.newSignature;

            return (
              <div
                key={idx}
                className={`py-2.5 flex items-center gap-3 ${
                  !result.success
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : result.isNew
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : result.isSkipped
                        ? ''
                        : 'bg-blue-50 dark:bg-blue-950/30'
                }`}
              >
                {/* Champion portrait */}
                <div className="shrink-0">
                  <ChampionPortrait
                    imageUrl={result.image_url}
                    name={result.champion_name}
                    rarity={result.newRarity}
                    size={40}
                  />
                </div>

                {/* Name & class */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" title={result.champion_name}>
                    {shortenChampionName(result.champion_name)}
                  </p>
                  <p className={`text-xs ${classColors.label}`}>
                    {result.champion_class ?? 'Unknown'}
                  </p>
                  {result.error && (
                    <p className="text-xs text-red-500 truncate" title={result.error}>
                      {result.error}
                    </p>
                  )}
                </div>

                {/* Status badge + diff */}
                <div className="shrink-0 text-right text-xs whitespace-nowrap">
                  {!result.success ? (
                    <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <FiAlertTriangle size={9} /> {t.roster.importExport.badgeError}
                    </span>
                  ) : result.isNew ? (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5">
                        {t.roster.importExport.badgeAdded}
                      </span>
                      <div className="text-gray-600 dark:text-gray-300">
                        {RARITY_LABELS[result.newRarity] ?? result.newRarity} · sig {result.newSignature}
                      </div>
                    </div>
                  ) : result.isSkipped ? (
                    <span className="inline-flex items-center gap-1 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {t.roster.importExport.badgeSkipped}
                    </span>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5">
                        {t.roster.importExport.badgeUpdated}
                      </span>
                      {hasRarityChange && (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400">
                            {RARITY_LABELS[result.oldRarity!] ?? result.oldRarity}
                          </span>
                          <FiArrowRight className="text-blue-500" size={10} />
                          <span className="text-blue-600 font-semibold">
                            {RARITY_LABELS[result.newRarity] ?? result.newRarity}
                          </span>
                        </div>
                      )}
                      {!hasRarityChange && (
                        <div className="text-gray-500">
                          {RARITY_LABELS[result.newRarity] ?? result.newRarity}
                        </div>
                      )}
                      {hasSigChange && (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400">sig {result.oldSignature}</span>
                          <FiArrowRight className="text-blue-500" size={10} />
                          <span className="text-blue-600 font-semibold">sig {result.newSignature}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button onClick={() => onOpenChange(false)}>
            {t.roster.importExport.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
