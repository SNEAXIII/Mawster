import { useRef } from 'react'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  SwatchIcon,
} from '@heroicons/react/24/solid'
import { cn } from '@/lib/cn'
import { FRAME_OPTIONS, type FrameOption } from '@/lib/types'
import type { LocaleKey } from '@/i18n/locales'
import type { Dictionary } from '@/i18n/locales'

interface ToolbarProps {
  title: string
  onTitleChange: (title: string) => void
  frame: FrameOption
  onFrameChange: (frame: FrameOption) => void
  cardSize: number
  onCardSizeChange: (size: number) => void
  showNames: boolean
  onShowNamesChange: (value: boolean) => void
  showBadges: boolean
  onShowBadgesChange: (value: boolean) => void
  locale: LocaleKey
  onLocaleChange: (locale: LocaleKey) => void
  busy: boolean
  onExportJson: () => void
  onImportJson: (file: File) => void
  onExportPng: () => void
  onReset: () => void
  onOpenIcons: () => void
  t: Dictionary
}

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40'

export default function Toolbar({
  title,
  onTitleChange,
  frame,
  onFrameChange,
  cardSize,
  onCardSizeChange,
  showNames,
  onShowNamesChange,
  showBadges,
  onShowBadgesChange,
  locale,
  onLocaleChange,
  busy,
  onExportJson,
  onImportJson,
  onExportPng,
  onReset,
  onOpenIcons,
  t,
}: Readonly<ToolbarProps>) {
  const fileInput = useRef<HTMLInputElement>(null)

  const frameLabel: Record<FrameOption, string> = {
    '7': t.frame7,
    '6': t.frame6,
    none: t.frameNone,
  }

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-border bg-card p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t.boardTitlePlaceholder}
          aria-label={t.boardTitlePlaceholder}
          className='min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1.5 text-sm font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-ring'
        />
        <select
          value={locale}
          onChange={(e) => onLocaleChange(e.target.value as LocaleKey)}
          aria-label={t.language}
          className='rounded-md border border-border bg-input px-2 py-1.5 text-xs font-semibold outline-none focus:border-ring'
        >
          <option value='en'>EN</option>
          <option value='fr'>FR</option>
        </select>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <select
          value={frame}
          onChange={(e) => onFrameChange(e.target.value as FrameOption)}
          aria-label={t.frame}
          className='rounded-md border border-border bg-input px-2 py-1.5 text-xs font-semibold outline-none focus:border-ring'
        >
          {FRAME_OPTIONS.map((option) => (
            <option
              key={option}
              value={option}
            >
              {frameLabel[option]}
            </option>
          ))}
        </select>

        <label className='flex items-center gap-2 text-xs font-semibold text-muted-foreground'>
          {t.cardSize}
          <input
            type='range'
            min={44}
            max={110}
            step={2}
            value={cardSize}
            onChange={(e) => onCardSizeChange(Number(e.target.value))}
            className='w-24 accent-primary'
          />
        </label>

        <label className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground'>
          <input
            type='checkbox'
            checked={showNames}
            onChange={(e) => onShowNamesChange(e.target.checked)}
            className='accent-primary'
          />
          {t.showNames}
        </label>

        <label className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground'>
          <input
            type='checkbox'
            checked={showBadges}
            onChange={(e) => onShowBadgesChange(e.target.checked)}
            className='accent-primary'
          />
          {t.showBadges}
        </label>

        <span
          aria-hidden
          className='mx-1 hidden h-5 w-px bg-border sm:block'
        />

        <button
          type='button'
          onClick={onOpenIcons}
          className={buttonClass}
        >
          <SwatchIcon className='h-4 w-4' />
          {t.icons}
        </button>
        <button
          type='button'
          onClick={onExportPng}
          disabled={busy}
          className={cn(buttonClass, 'border-primary/50 text-primary')}
        >
          <PhotoIcon className='h-4 w-4' />
          {t.exportPng}
        </button>
        <button
          type='button'
          onClick={onExportJson}
          className={buttonClass}
        >
          <ArrowDownTrayIcon className='h-4 w-4' />
          {t.exportJson}
        </button>
        <button
          type='button'
          onClick={() => fileInput.current?.click()}
          className={buttonClass}
        >
          <ArrowUpTrayIcon className='h-4 w-4' />
          {t.importJson}
        </button>
        <input
          ref={fileInput}
          type='file'
          accept='application/json,.json'
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportJson(file)
            // Reset so re-importing the same file fires `change` again.
            e.target.value = ''
          }}
        />
        <button
          type='button'
          onClick={onReset}
          className={cn(buttonClass, 'hover:text-destructive')}
        >
          <ArrowPathIcon className='h-4 w-4' />
          {t.reset}
        </button>
      </div>
    </div>
  )
}
