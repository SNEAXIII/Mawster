'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { FiFlag } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { getChampionImageUrl } from '@/app/services/champions'
import { shortenChampionName } from '@/app/services/roster'
import type { FightRecord, SynergyRecord, PrefightRecord } from '@/app/services/fight-records'
import { reportNote } from '@/app/services/moderation'
import ChampionPortrait from '@/components/champion-portrait'
import { useExportMode } from '@/app/contexts/export-mode-context'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/app/lib/utils'
import { COMPACT_COL, GROW_COL } from './knowledge-base-columns'

/** Same size everywhere — only the surrounding padding is tightened. */
const PORTRAIT_SIZE = 52
const EXPORT_PORTRAIT_SIZE = 56

type ChampionCellProps = Readonly<{
  name: string
  imageUrl: string | null
  stars?: number | null
  rank?: number | null
  ascension?: number | null
  isSaga?: boolean | null
  sagaMode: 'attacker' | 'defender'
  dataCy: string
}>

/**
 * Attacker / defender cell — framed portrait with the rank underneath. No champion
 * name: the frame already says how many stars, and the name is kept for screen
 * readers and the tooltip only.
 */
export function ChampionCell({
  name,
  imageUrl,
  stars,
  rank,
  ascension,
  isSaga,
  sagaMode,
  dataCy,
}: ChampionCellProps) {
  const exporting = useExportMode()
  return (
    <td
      className={cn(COMPACT_COL, 'py-1')}
      data-cy={dataCy}
    >
      <div
        className='flex flex-col items-center'
        title={shortenChampionName(name)}
        data-cy-champion={name}
      >
        <ChampionPortrait
          imageUrl={imageUrl}
          name={name}
          rarity={String(stars ?? 7)}
          size={exporting ? EXPORT_PORTRAIT_SIZE : PORTRAIT_SIZE}
          box='frame'
          ascension={ascension ?? 0}
          is_saga_attacker={sagaMode === 'attacker' && !!isSaga}
          is_saga_defender={sagaMode === 'defender' && !!isSaga}
          sagaMode={sagaMode}
        />
        <span className='text-xs leading-tight text-muted-foreground whitespace-nowrap'>
          {rank != null ? `R${rank}` : '—'}
        </span>
        <span className='sr-only'>{name}</span>
      </div>
    </td>
  )
}

type ChampionIconListProps = Readonly<{
  champions: ReadonlyArray<SynergyRecord | PrefightRecord>
  dataCy: string
}>

/**
 * Synergy / prefight cell — a row of small unframed thumbnails, the name only in
 * the tooltip. Both columns render the same thing off the same record shape.
 */
export function ChampionIconList({ champions, dataCy }: ChampionIconListProps) {
  const exporting = useExportMode()
  return (
    <td
      className={cn(COMPACT_COL, 'py-2')}
      data-cy={dataCy}
    >
      <div className='flex items-center justify-center gap-1'>
        {champions.map((c) => {
          // Full-resolution source while exporting: the capture is upscaled, a
          // 40px thumbnail would come out blurry (same trick as ChampionPortrait).
          const src = getChampionImageUrl(c.image_url, exporting ? undefined : 40)
          return src ? (
            <img
              key={c.champion_id}
              src={src}
              alt={c.champion_name}
              title={c.champion_name}
              className='w-9 h-9 object-contain rounded'
            />
          ) : (
            <span
              key={c.champion_id}
              className='text-xs text-muted-foreground'
            >
              {c.champion_name}
            </span>
          )
        })}
      </div>
    </td>
  )
}

type NoteCellProps = Readonly<{ record: FightRecord }>

/** Note cell — truncated inline, full text in a popover, plus the report flag. */
export function NoteCell({ record }: NoteCellProps) {
  const { t } = useI18n()
  const [reported, setReported] = useState(false)
  const hasNote = !record.note_blocked && !!record.note

  const onReport = async () => {
    if (!record.note_id) return
    try {
      await reportNote(record.note_id)
      setReported(true)
      toast.success(t.moderation.reportSuccess)
    } catch (err) {
      toast.error((err as Error).message || t.moderation.reportError)
    }
  }

  return (
    <td className={cn(GROW_COL, 'py-2')}>
      <div className='flex flex-col gap-0.5'>
        <div className='flex items-start gap-1'>
          {record.note_blocked && (
            <span
              className='italic text-muted-foreground truncate'
              data-cy='kb-note-blocked'
            >
              {t.moderation.noteBlocked}
            </span>
          )}
          {!record.note_blocked && hasNote && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type='button'
                  className='min-w-0 truncate text-left cursor-pointer hover:text-foreground transition-colors'
                  data-cy='kb-note-text'
                  title={t.game.knowledgeBase.noteExpand}
                >
                  {record.note}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className='max-h-80 w-80 overflow-y-auto whitespace-pre-wrap break-words text-sm'
                data-cy='kb-note-popover'
              >
                {record.note}
                {record.note_author && (
                  <p className='mt-2 text-[10px] text-muted-foreground'>
                    {t.game.knowledgeBase.noteBy} {record.note_author}
                  </p>
                )}
              </PopoverContent>
            </Popover>
          )}
          {!record.note_blocked && !hasNote && <span className='text-muted-foreground'>—</span>}
          {record.note_id && !record.note_blocked && (
            <button
              className='shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              data-cy='kb-note-report'
              disabled={reported}
              title={reported ? t.moderation.reported : t.moderation.report}
              onClick={onReport}
            >
              <FiFlag className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
        {record.note_author && !record.note_blocked && (
          <span
            className='text-[10px] text-muted-foreground truncate'
            data-cy='kb-note-author'
          >
            {t.game.knowledgeBase.noteBy} {record.note_author}
          </span>
        )}
      </div>
    </td>
  )
}
