'use client'

import React from 'react'
import { useI18n } from '@/app/i18n'
import ChampionPortrait from '@/components/champion-portrait'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RARITIES, RARITY_LABELS, shortenChampionName, getClassColors } from '@/app/services/roster'
import type { PreviewRow, PreviewRowPatch } from './import-preview-row'
import ImportPreviewChampionPicker from './import-preview-champion-picker'

interface ImportPreviewRowEditProps {
  row: PreviewRow
  index: number
  onRowChange?: (index: number, patch: PreviewRowPatch) => void
}

// Unmeasured estimates, deliberately named so they are cheap to tune. Ground
// truth: mean margin 0.067, and both observed misreads sat at 0.01.
const MARGIN_AMBIGUOUS = 0.008
const MARGIN_UNCERTAIN = 0.02

// The gap to the runner-up, not the absolute score. Both real misreads scored
// 0.79 — high enough for a score-based threshold to paint them green — while
// sitting 0.01 ahead of the right answer. No margin at all means fewer than two
// candidates, which usually means the portrait crop failed and the row has no
// name: the case needing the most attention, so it takes the loudest badge.
export type MarginLevel = 'low' | 'medium' | 'high'

export function marginLevel(margin: number | null | undefined): MarginLevel {
  if (margin == null) return 'low'
  if (margin < MARGIN_AMBIGUOUS) return 'low'
  if (margin < MARGIN_UNCERTAIN) return 'medium'
  return 'high'
}

const MARGIN_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-red-600 text-white border-transparent',
  medium: 'bg-orange-500 text-white border-transparent',
  high: 'bg-green-600 text-white border-transparent',
}

// isNew wins over hasChanges: the row-change handler forces hasChanges to true on
// new rows so they always count toward the import, so the two are not exclusive.
function rowStatus(row: PreviewRow): 'new' | 'updated' | 'unchanged' {
  if (row.isNew) return 'new'
  return row.hasChanges ? 'updated' : 'unchanged'
}

const STATUS_CLASSES: Record<'new' | 'updated' | 'unchanged', string> = {
  new: 'bg-green-600 text-white border-transparent',
  updated: 'bg-blue-600 text-white border-transparent',
  unchanged: 'bg-transparent text-muted-foreground border-border italic',
}

export default function ImportPreviewRowEdit({
  row,
  index,
  onRowChange,
}: ImportPreviewRowEditProps) {
  const { t } = useI18n()
  const emit = (patch: PreviewRowPatch) => onRowChange?.(index, patch)

  const level = marginLevel(row.margin)
  const marginLabels: Record<'low' | 'medium' | 'high', string> = {
    low: t.roster.importExport.vision.marginAmbiguous,
    medium: t.roster.importExport.vision.marginUncertain,
    high: t.roster.importExport.vision.marginClear,
  }

  const status = rowStatus(row)
  const statusLabels: Record<'new' | 'updated' | 'unchanged', string> = {
    new: t.roster.importExport.badgeNew,
    updated: t.roster.importExport.badgeUpdated,
    unchanged: t.roster.importExport.badgeUnchanged,
  }

  return (
    <div className='py-2.5 flex items-center gap-3'>
      <div className='shrink-0'>
        {row.cropUrl ? (
          <img
            src={row.cropUrl}
            alt={row.champion_name}
            loading='lazy'
            className='h-20 w-20 rounded object-cover border border-border'
            data-cy={`preview-row-crop-${index}`}
          />
        ) : (
          <ChampionPortrait
            imageUrl={row.image_url}
            name={row.champion_name}
            rarity={row.newRarity}
            size={40}
          />
        )}
      </div>

      <div className='min-w-0 flex-1'>
        <ImportPreviewChampionPicker
          index={index}
          championName={shortenChampionName(row.champion_name)}
          candidates={row.candidates ?? []}
          onPick={(name) => emit({ champion_name: name })}
        />
        <p className={`text-xs ${getClassColors(row.champion_class ?? 'Unknown').label}`}>
          {row.champion_class ?? 'Unknown'}
        </p>
        <div className='mt-1 flex items-center gap-1'>
          {row.corrected ? (
            <Badge
              className='text-[10px] px-1.5 py-0 bg-sky-600 text-white border-transparent'
              data-cy={`preview-row-margin-badge-${index}`}
              data-level='corrected'
            >
              {t.roster.importExport.vision.marginCorrected}
            </Badge>
          ) : (
            <Badge
              className={`text-[10px] px-1.5 py-0 ${MARGIN_CLASSES[level]}`}
              data-cy={`preview-row-margin-badge-${index}`}
              data-level={level}
            >
              {marginLabels[level]}
            </Badge>
          )}
          <Badge
            variant='outline'
            className={`text-[10px] px-1.5 py-0 ${STATUS_CLASSES[status]}`}
            data-cy={`preview-row-status-badge-${index}`}
            data-status={status}
          >
            {statusLabels[status]}
          </Badge>
        </div>
      </div>

      <div className='shrink-0 flex items-center gap-1.5'>
        <Select
          value={row.newRarity}
          onValueChange={(value) => emit({ newRarity: value })}
        >
          <SelectTrigger
            className='h-8 w-[4.5rem] text-xs px-2'
            data-cy={`preview-row-rarity-select-${index}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RARITIES.map((rarity) => (
              <SelectItem
                key={rarity}
                value={rarity}
              >
                {RARITY_LABELS[rarity] ?? rarity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type='number'
          min={0}
          className='h-8 w-14 text-xs px-2'
          value={row.newSignature}
          onChange={(e) => emit({ newSignature: Number(e.target.value) })}
          data-cy={`preview-row-signature-input-${index}`}
        />

        <Input
          type='number'
          min={0}
          className='h-8 w-14 text-xs px-2'
          value={row.ascension ?? 0}
          onChange={(e) => emit({ ascension: Number(e.target.value) })}
          data-cy={`preview-row-ascension-input-${index}`}
        />
      </div>
    </div>
  )
}
