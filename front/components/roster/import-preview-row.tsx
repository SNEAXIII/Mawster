'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { FiArrowRight } from 'react-icons/fi';
import ChampionPortrait from '@/components/champion-portrait';
import {
  RARITY_LABELS,
  shortenChampionName,
  getClassColors,
} from '@/app/services/roster';

export interface PreviewRow {
  champion_name: string;
  champion_class: string | null;
  image_url: string | null;
  newRarity: string;
  newSignature: number;
  oldRarity: string | null;
  oldSignature: number | null;
  isNew: boolean;
  hasChanges: boolean;
}

interface ImportPreviewRowProps {
  row: PreviewRow;
}

export default function ImportPreviewRow({ row }: ImportPreviewRowProps) {
  const { t } = useI18n();

  return (
    <div
      className={`py-2.5 flex items-center gap-3 ${
        row.isNew
          ? 'bg-green-50 dark:bg-green-950/30'
          : row.hasChanges
            ? 'bg-blue-50 dark:bg-blue-950/30'
            : ''
      }`}
    >
      {/* Champion portrait */}
      <div className="shrink-0">
        <ChampionPortrait
          imageUrl={row.image_url}
          name={row.champion_name}
          rarity={row.newRarity}
          size={40}
        />
      </div>

      {/* Name & class */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" title={row.champion_name}>
          {shortenChampionName(row.champion_name)}
        </p>
        <p className={`text-xs ${getClassColors(row.champion_class ?? 'Unknown').label}`}>
          {row.champion_class ?? 'Unknown'}
        </p>
      </div>

      {/* Status badge + diff */}
      <div className="shrink-0 text-right text-xs whitespace-nowrap">
        {row.isNew ? (
          <div>
            <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5">
              {t.roster.importExport.badgeNew}
            </span>
            <div className="text-gray-600 dark:text-gray-300">
              {RARITY_LABELS[row.newRarity] ?? row.newRarity} · sig {row.newSignature}
            </div>
          </div>
        ) : row.hasChanges ? (
          <div className="space-y-0.5">
            {row.oldRarity !== row.newRarity && (
              <div className="flex items-center gap-1 justify-end">
                <span className="text-gray-400">
                  {RARITY_LABELS[row.oldRarity!] ?? row.oldRarity}
                </span>
                <FiArrowRight className="text-blue-500" size={10} />
                <span className="text-blue-600 font-semibold">
                  {RARITY_LABELS[row.newRarity] ?? row.newRarity}
                </span>
              </div>
            )}
            {row.oldRarity === row.newRarity && (
              <div className="text-gray-500">
                {RARITY_LABELS[row.newRarity] ?? row.newRarity}
              </div>
            )}
            {row.oldSignature !== row.newSignature && (
              <div className="flex items-center gap-1 justify-end">
                <span className="text-gray-400">sig {row.oldSignature}</span>
                <FiArrowRight className="text-blue-500" size={10} />
                <span className="text-blue-600 font-semibold">sig {row.newSignature}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic">
            {t.roster.importExport.badgeUnchanged}
          </span>
        )}
      </div>
    </div>
  );
}
