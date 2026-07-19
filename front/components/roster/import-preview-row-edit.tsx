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

interface ImportPreviewRowEditProps {
  row: PreviewRow
  index: number
  onRowChange?: (index: number, patch: PreviewRowPatch) => void
}

function confidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < 0.5) return 'low'
  if (confidence < 0.75) return 'medium'
  return 'high'
}

const CONFIDENCE_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-red-600 text-white border-transparent',
  medium: 'bg-orange-500 text-white border-transparent',
  high: 'bg-green-600 text-white border-transparent',
}

export default function ImportPreviewRowEdit({
  row,
  index,
  onRowChange,
}: ImportPreviewRowEditProps) {
  const { t } = useI18n()
  const emit = (patch: PreviewRowPatch) => onRowChange?.(index, patch)

  const level = row.confidence != null ? confidenceLevel(row.confidence) : null
  const confidenceLabels: Record<'low' | 'medium' | 'high', string> = {
    low: t.roster.importExport.vision.confidenceLow,
    medium: t.roster.importExport.vision.confidenceMedium,
    high: t.roster.importExport.vision.confidenceHigh,
  }

  return (
    <div className='py-2.5 flex items-center gap-3'>
      <div className='shrink-0'>
        {row.cropUrl ? (
          <img
            src={row.cropUrl}
            alt={row.champion_name}
            loading='lazy'
            className='h-24 w-24 rounded object-cover border border-border'
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
        <p
          className='text-sm font-semibold truncate'
          title={row.champion_name}
        >
          {shortenChampionName(row.champion_name)}
        </p>
        <p className={`text-xs ${getClassColors(row.champion_class ?? 'Unknown').label}`}>
          {row.champion_class ?? 'Unknown'}
        </p>
        {level != null && (
          <Badge
            className={`mt-1 text-[10px] px-1.5 py-0 ${CONFIDENCE_CLASSES[level]}`}
            data-cy={`preview-row-confidence-badge-${index}`}
          >
            {confidenceLabels[level]}
          </Badge>
        )}
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
