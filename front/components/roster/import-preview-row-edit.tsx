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
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { RARITIES, RARITY_LABELS, shortenChampionName, getClassColors } from '@/app/services/roster'
import { SPRITE_COLS, SPRITE_DISPLAY } from '@/app/services/vision'
import type { PreviewRow, PreviewRowPatch } from './import-preview-row'
import { rowIssues } from './import-row-validation'
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

function rowStateClass(ignored: boolean, invalid: boolean): string {
  if (ignored) return 'opacity-50'
  if (invalid) return '-mx-1 rounded-md border border-red-500/60 bg-red-50 px-1 dark:bg-red-950/30'
  return ''
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

  // The sheet can be gone: confirming or cancelling an import purges its whole
  // prefix, so a review dialog left open across a confirm asks for an object
  // that no longer exists. An <img> is what makes that observable — a failed
  // background-image is silent and would leave an empty grey box.
  const [spriteFailed, setSpriteFailed] = React.useState(false)

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

  // An ignored row is out of the import, so its own problems no longer block
  // anything — showing them would just be noise on a row the user parked.
  const issues = row.ignored ? [] : rowIssues(row)
  const issueLabels: Record<'missingName' | 'invalidRarity', string> = {
    missingName: t.roster.importExport.issueMissingName,
    invalidRarity: t.roster.importExport.issueInvalidRarity.replace('{rarity}', row.newRarity),
  }

  return (
    <div
      className={`flex flex-col gap-2 py-3 ${rowStateClass(row.ignored === true, issues.length > 0)}`}
      data-cy={`preview-row-${index}`}
      data-invalid={issues.length > 0}
      data-ignored={row.ignored === true}
    >
      <div className='flex gap-3'>
        <div className='shrink-0'>
          {row.spriteUrl && row.cropIndex != null && !spriteFailed ? (
            // The box is sized from SPRITE_DISPLAY rather than an h-24/w-24 rem
            // pair: rem tracks the browser's root font size, and a user who raised
            // it would get a box larger than the pixel arithmetic slicing it, so
            // the neighbouring cells would bleed in and a row would show two
            // champions' art. One number drives both, so they cannot disagree.
            <div
              className='overflow-hidden rounded-md border border-border'
              style={{ width: SPRITE_DISPLAY / 1.3, height: SPRITE_DISPLAY / 1.3 }}
            >
              <img
                src={row.spriteUrl}
                alt={row.champion_name}
                onError={() => setSpriteFailed(true)}
                // The sheet is always SPRITE_COLS cells wide, so scaling it to
                // SPRITE_COLS box-widths makes one cell exactly one box. Still one
                // request for the whole screenshot, as with the background-image.
                // Width and both offsets are percentages of the same box, so the
                // border eating into the content width shifts nothing — and a
                // percentage margin-top resolves against the *width* too, which is
                // what makes the vertical step match the horizontal one on a
                // square cell.
                className='max-w-none'
                style={{
                  width: `${SPRITE_COLS * 100}%`,
                  marginLeft: `${-(row.cropIndex % SPRITE_COLS) * 100}%`,
                  marginTop: `${-Math.floor(row.cropIndex / SPRITE_COLS) * 100}%`,
                }}
                data-cy={`preview-row-crop-${index}`}
              />
            </div>
          ) : (
            <ChampionPortrait
              imageUrl={row.image_url}
              name={row.champion_name}
              rarity={row.newRarity}
              size={40}
            />
          )}
        </div>

        {/* Identity: name, class and the two badges on one wrapping line */}
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 self-start'>
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
          <div className='grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2'>
            <label className='flex min-w-0 flex-col gap-0.5'>
              <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
                {t.roster.importExport.rarityLabel}
              </span>
              <Select
                value={row.newRarity}
                onValueChange={(value) => emit({ newRarity: value })}
              >
                <SelectTrigger
                  className={`h-8 w-full text-xs px-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0 ${
                    issues.includes('invalidRarity') ? 'border-red-500 text-red-600' : ''
                  }`}
                  data-cy={`preview-row-rarity-select-${index}`}
                >
                  {/* A rank the model misread (`7r0`) matches no item, and Radix
                      then renders an empty trigger — the silent state that let a
                      bad row reach the atomic bulk endpoint. */}
                  <SelectValue placeholder={t.roster.importExport.rarityUnread} />
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

            <label className='flex min-w-0 flex-col gap-0.5'>
              <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
                {t.roster.importExport.sigLabel}
              </span>
              <Input
                type='number'
                min={0}
                max={MAX_SIGNATURE}
                className='h-8 w-full min-w-0 text-xs px-2'
                value={row.newSignature}
                onChange={(e) => emit({ newSignature: clamp(e.target.value, MAX_SIGNATURE) })}
                data-cy={`preview-row-signature-input-${index}`}
              />
            </label>

            <label className='flex min-w-0 flex-col gap-0.5'>
              <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
                {t.roster.importExport.ascLabel}
              </span>
              <Input
                type='number'
                min={0}
                max={MAX_ASCENSION}
                className='h-8 w-full min-w-0 text-xs px-2'
                value={row.ascension ?? 0}
                onChange={(e) => emit({ ascension: clamp(e.target.value, MAX_ASCENSION) })}
                data-cy={`preview-row-ascension-input-${index}`}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Why this row blocks the import, and the way out for one no correction
          can rescue — a false detection has no right answer to pick. */}
      {issues.length > 0 && (
        <div
          className='flex items-start gap-2 text-xs text-red-600 dark:text-red-400'
          data-cy={`preview-row-issues-${index}`}
        >
          <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' />
          <span className='min-w-0 flex-1'>{issues.map((i) => issueLabels[i]).join(' · ')}</span>
          <Button
            variant='outline'
            size='sm'
            className='h-6 shrink-0 px-2 text-[11px]'
            onClick={() => emit({ ignored: true })}
            data-cy={`preview-row-ignore-button-${index}`}
          >
            {t.roster.importExport.ignoreRow}
          </Button>
        </div>
      )}

      {row.ignored && (
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='min-w-0 flex-1'>{t.roster.importExport.rowIgnored}</span>
          <Button
            variant='outline'
            size='sm'
            className='h-6 shrink-0 px-2 text-[11px]'
            onClick={() => emit({ ignored: false })}
            data-cy={`preview-row-restore-button-${index}`}
          >
            {t.roster.importExport.restoreRow}
          </Button>
        </div>
      )}
    </div>
  )
}
