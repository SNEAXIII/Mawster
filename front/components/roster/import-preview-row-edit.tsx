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
import { SPRITE_COLS, SPRITE_DISPLAY } from '@/app/services/vision'
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

// Same bounds the backend enforces: signature <= 200, ascension in 0..2
// (dto_champion_user: ge=0, le=2). The max attribute alone does not stop a
// paste or a typed-over value, so every edit is clamped here too.
const MAX_SIGNATURE = 200
const MAX_ASCENSION = 2

function clamp(raw: string, max: number): number {
  const n = Number(raw)
  if (Number.isNaN(n)) return 0
  return Math.min(max, Math.max(0, Math.trunc(n)))
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
    <div className='flex gap-3 py-3'>
      <div className='shrink-0'>
        {row.spriteUrl && row.cropIndex != null ? (
          <div
            role='img'
            aria-label={row.champion_name}
            className='h-24 w-24 rounded-md border border-border bg-no-repeat'
            style={{
              backgroundImage: `url(${row.spriteUrl})`,
              backgroundSize: `${SPRITE_COLS * SPRITE_DISPLAY}px auto`,
              backgroundPosition: `-${(row.cropIndex % SPRITE_COLS) * SPRITE_DISPLAY}px -${Math.floor(row.cropIndex / SPRITE_COLS) * SPRITE_DISPLAY}px`,
            }}
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

      <div className='min-w-0 flex-1 space-y-1.5'>
        {/* Identity: name, class and the two badges on one wrapping line */}
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <ImportPreviewChampionPicker
            index={index}
            championName={shortenChampionName(row.champion_name)}
            championImageUrl={row.image_url}
            candidates={row.candidates ?? []}
            onPick={(name) => emit({ champion_name: name })}
          />
          <span className={`text-xs ${getClassColors(row.champion_class ?? 'Unknown').label}`}>
            {row.champion_class ?? 'Unknown'}
          </span>
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
        <div className='flex flex-row gap-6'>
          <label className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
              {t.roster.importExport.rarityLabel}
            </span>
            <Select
              value={row.newRarity}
              onValueChange={(value) => emit({ newRarity: value })}
            >
              <SelectTrigger
                className='h-8 w-full text-xs px-2'
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
          </label>

          <label className='flex flex-col gap-0.5'>
            <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
              {t.roster.importExport.sigLabel}
            </span>
            <Input
              type='number'
              min={0}
              max={MAX_SIGNATURE}
              className='h-8 w-full text-xs px-2'
              value={row.newSignature}
              onChange={(e) => emit({ newSignature: clamp(e.target.value, MAX_SIGNATURE) })}
              data-cy={`preview-row-signature-input-${index}`}
            />
          </label>

          <label className='flex flex-col gap-0.5'>
            <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
              {t.roster.importExport.ascLabel}
            </span>
            <Input
              type='number'
              min={0}
              max={MAX_ASCENSION}
              className='h-8 w-full text-xs px-2'
              value={row.ascension ?? 0}
              onChange={(e) => emit({ ascension: clamp(e.target.value, MAX_ASCENSION) })}
              data-cy={`preview-row-ascension-input-${index}`}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
