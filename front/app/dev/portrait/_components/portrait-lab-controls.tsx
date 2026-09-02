'use client'

import { FrameWindow } from '@/components/champion-portrait'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export interface PortraitLabState {
  championIndex: number
  stars: '6' | '7'
  size: number
  preferred: boolean
  saga: boolean
  ascension: 0 | 1 | 2
  outline: boolean
  window: FrameWindow
}

interface Props {
  champions: readonly { name: string; imageUrl: string }[]
  state: PortraitLabState
  onChange: (patch: Partial<PortraitLabState>) => void
  onResetWindow: () => void
}

const SELECT_CLASS = 'rounded border border-border bg-background px-2 py-1 text-sm text-foreground'
const FIELD_CLASS = 'flex flex-col gap-1 text-xs text-muted-foreground'

/** Image placement sliders — fractions of the frame, so they hold at every size. */
const WINDOW_FIELDS: { key: keyof FrameWindow; label: string; min: number }[] = [
  { key: 'left', label: 'left', min: 0 },
  { key: 'top', label: 'top', min: 0 },
  { key: 'width', label: 'width', min: 0.2 },
  { key: 'height', label: 'height', min: 0.2 },
  { key: 'focusY', label: 'focus Y (crop anchor)', min: 0 },
]

export default function PortraitLabControls({
  champions,
  state,
  onChange,
  onResetWindow,
}: Readonly<Props>) {
  const patchWindow = (key: keyof FrameWindow, value: number) =>
    onChange({ window: { ...state.window, [key]: value } })

  return (
    <div className='flex flex-col gap-4 rounded-md border border-border bg-card p-4'>
      <div className='flex flex-wrap items-end gap-6'>
        <label className={FIELD_CLASS}>
          <span>Champion</span>
          <select
            className={SELECT_CLASS}
            value={state.championIndex}
            onChange={(e) => onChange({ championIndex: Number(e.target.value) })}
            data-cy='lab-champion'
          >
            {champions.map((c, i) => (
              <option
                key={c.imageUrl}
                value={i}
              >
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className={FIELD_CLASS}>
          <span>Frame</span>
          <select
            className={SELECT_CLASS}
            value={state.stars}
            onChange={(e) => onChange({ stars: e.target.value as '6' | '7' })}
            data-cy='lab-stars'
          >
            <option value='6'>6★</option>
            <option value='7'>7★</option>
          </select>
        </label>

        <label className={FIELD_CLASS}>
          <span>Ascension</span>
          <select
            className={SELECT_CLASS}
            value={state.ascension}
            onChange={(e) => onChange({ ascension: Number(e.target.value) as 0 | 1 | 2 })}
            data-cy='lab-ascension-level'
          >
            <option value={0}>none</option>
            <option value={1}>A1</option>
            <option value={2}>A2</option>
          </select>
        </label>

        <div className='flex flex-col gap-2'>
          {(
            [
              ['preferred', 'Preferred attacker (crown)'],
              ['saga', 'Saga badge'],
              ['outline', 'Outline the box'],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className='flex items-center gap-2'
            >
              <Checkbox
                id={`lab-${key}`}
                checked={state[key]}
                onCheckedChange={(v) => onChange({ [key]: v === true })}
                data-cy={`lab-${key}`}
              />
              <Label
                htmlFor={`lab-${key}`}
                className='text-xs font-normal'
              >
                {label}
              </Label>
            </div>
          ))}
        </div>

        <label className='flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground'>
          <span>Size — {state.size}px</span>
          <input
            type='range'
            min={20}
            max={150}
            step={1}
            value={state.size}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
            className='w-full accent-yellow-400'
            data-cy='lab-size'
          />
        </label>
      </div>

      <div className='flex flex-col gap-2 border-t border-border pt-3'>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-xs font-semibold text-muted-foreground'>
            Image placement — fractions of the frame, identical at every size
          </span>
          <button
            type='button'
            className='rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground'
            onClick={onResetWindow}
            data-cy='lab-reset-window'
          >
            Reset to shipped values
          </button>
        </div>
        <div className='grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3'>
          {WINDOW_FIELDS.map(({ key, label, min }) => (
            <label
              key={key}
              className={FIELD_CLASS}
            >
              <span>
                {label} — {state.window[key].toFixed(4)}
              </span>
              <input
                type='range'
                min={min}
                max={1}
                step={0.0005}
                value={state.window[key]}
                onChange={(e) => patchWindow(key, Number(e.target.value))}
                className='w-full accent-yellow-400'
                data-cy={`lab-window-${key}`}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
