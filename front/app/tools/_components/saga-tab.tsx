'use client'

import { useRef } from 'react'
import { FiDownload } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import { useImageExport } from '@/hooks/use-image-export'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSaga } from '../_hooks/use-saga'
import SagaBoard from './saga-board'

/** The saga attackers and defenders of a regular season, with a PNG export. */
export default function SagaTab() {
  const { t } = useI18n()
  const { seasons, seasonNumber, setSeasonNumber, attackers, defenders, loading, error } = useSaga()
  const captureRef = useRef<HTMLDivElement>(null)
  const { exporting, exportImage } = useImageExport()

  if (error)
    return (
      <p
        className='text-sm text-destructive'
        data-cy='saga-error'
      >
        {t.saga.loadError}
      </p>
    )
  if (seasons === null) return null
  if (seasons.length === 0)
    return (
      <p
        className='text-sm text-muted-foreground'
        data-cy='saga-no-season'
      >
        {t.saga.noSeason}
      </p>
    )

  const empty = !loading && attackers.length === 0 && defenders.length === 0

  return (
    <ExportModeProvider value={exporting}>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Select
            value={String(seasonNumber ?? '')}
            onValueChange={(value) => setSeasonNumber(Number(value))}
          >
            <SelectTrigger
              className='w-44'
              data-cy='saga-season-select'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem
                  key={season.number}
                  value={String(season.number)}
                  data-cy={`saga-season-option-${season.number}`}
                >
                  {(season.status === 'upcoming' ? t.saga.seasonUpcoming : t.saga.season).replace(
                    '{number}',
                    String(season.number)
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => exportImage(captureRef, `saga-season-${seasonNumber}.jpg`)}
            disabled={loading || empty || exporting}
            data-cy='saga-export-btn'
          >
            <FiDownload />
            {t.saga.exportPng}
          </Button>
        </div>

        {empty && (
          <p
            className='text-sm text-muted-foreground'
            data-cy='saga-empty'
          >
            {t.saga.empty}
          </p>
        )}
        {!empty && !loading && seasonNumber !== null && (
          <SagaBoard
            ref={captureRef}
            seasonNumber={seasonNumber}
            attackers={attackers}
            defenders={defenders}
          />
        )}
      </div>
    </ExportModeProvider>
  )
}
