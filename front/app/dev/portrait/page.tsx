'use client'

import { useState } from 'react'
import ChampionPortrait, {
  FRAME_WINDOWS,
  getFrameWindowRect,
  pickThumbnailSize,
} from '@/components/champion-portrait'
import PortraitLabControls, { PortraitLabState } from './_components/portrait-lab-controls'
import { cn } from '@/app/lib/utils'

// Static assets, no auth needed — served through the /static rewrite.
const CHAMPIONS = [
  { name: 'Thanos', imageUrl: '/static/champions/thanos.png' },
  { name: 'Absorbing Man', imageUrl: '/static/champions/absorbing_man.png' },
  { name: 'Black Panther', imageUrl: '/static/champions/black_panther.png' },
  { name: 'Sentinel', imageUrl: '/static/champions/sentinel.png' },
  { name: 'Lumatrix', imageUrl: '/static/champions/lumatrix.png' },
  { name: 'Groot', imageUrl: '/static/champions/groot.png' },
  { name: 'Hercules', imageUrl: '/static/champions/hercules.png' },
  { name: 'Onslaught', imageUrl: '/static/champions/onslaught.png' },
] as const

const SIZES = Array.from({ length: 14 }, (_, i) => 20 + i * 10) // 20 → 150, step 10

const COMBINATIONS = [
  { label: 'plain', preferred: false, saga: false, ascension: 0 },
  { label: 'preferred', preferred: true, saga: false, ascension: 0 },
  { label: 'saga', preferred: false, saga: true, ascension: 0 },
  { label: 'asc A1', preferred: false, saga: false, ascension: 1 },
  { label: 'asc A2', preferred: false, saga: false, ascension: 2 },
  { label: 'all', preferred: true, saga: true, ascension: 2 },
] as const

/**
 * Dev-only sandbox for ChampionPortrait: every size from 20 to 150 with any
 * combination of badges, plus sliders on the image placement so the fit inside
 * the frame can be dialled in and the resulting fractions copied back into
 * FRAME_WINDOWS.
 */
export default function PortraitLabPage() {
  const [state, setState] = useState<PortraitLabState>({
    championIndex: 0,
    stars: '7',
    size: 72,
    preferred: true,
    saga: true,
    ascension: 2,
    outline: false,
    window: FRAME_WINDOWS['7'],
  })
  const patch = (p: Partial<PortraitLabState>) =>
    setState((s) => ({ ...s, ...p, ...(p.stars ? { window: FRAME_WINDOWS[p.stars] } : {}) }))

  const champion = CHAMPIONS[state.championIndex]
  const rarity = `${state.stars}r5`

  const portrait = (size: number, over?: (typeof COMBINATIONS)[number]) => (
    <ChampionPortrait
      imageUrl={champion.imageUrl}
      name={champion.name}
      rarity={rarity}
      size={size}
      frameWindow={state.window}
      isPreferred={over ? over.preferred : state.preferred}
      is_saga_attacker={over ? over.saga : state.saga}
      ascension={over ? over.ascension : state.ascension}
    />
  )

  /** Champion image width the portrait asks for, and the variant it resolves to. */
  const resolution = (size: number) => {
    const windowPx = getFrameWindowRect(size, rarity, state.window).width
    const picked = pickThumbnailSize(windowPx)
    return `${Math.round(windowPx)}px → ${picked ? `${picked}x${picked}` : 'full'}`
  }

  const boxClass = state.outline ? 'outline outline-1 outline-dashed outline-red-500/60' : ''

  return (
    <main className='mx-auto flex max-w-6xl flex-col gap-6 p-6'>
      <header>
        <h1 className='text-xl font-semibold'>Champion portrait lab</h1>
        <p className='text-sm text-muted-foreground'>
          Dev page — not linked from the app. Sizes 20 → 150 (step 10) plus a free slider.
        </p>
      </header>

      <PortraitLabControls
        champions={CHAMPIONS}
        state={state}
        onChange={patch}
        onResetWindow={() => patch({ window: FRAME_WINDOWS[state.stars] })}
      />

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Slider — {state.size}px</h2>
        <div className='flex flex-wrap items-end gap-6 rounded-md border border-border bg-card p-4'>
          <div className={boxClass}>{portrait(state.size)}</div>
          <p className='text-xs text-muted-foreground'>image {resolution(state.size)}</p>
          <code className='rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground'>
            {`'${state.stars}': { left: ${state.window.left}, top: ${state.window.top}, width: ${state.window.width}, height: ${state.window.height}, focusY: ${state.window.focusY} }`}
          </code>
        </div>
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold text-muted-foreground'>All sizes</h2>
        <div className='flex flex-wrap items-end gap-4 rounded-md border border-border bg-card p-4'>
          {SIZES.map((size) => (
            <div
              key={size}
              className='flex flex-col items-center gap-1'
              data-cy={`lab-portrait-${size}`}
            >
              <div className={boxClass}>{portrait(size)}</div>
              <span className='text-[10px] leading-none text-muted-foreground'>{size}px</span>
              <span className='text-[9px] leading-none text-muted-foreground/70'>
                {resolution(size)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold text-muted-foreground'>
          All sizes × badge combinations
        </h2>
        <div className='overflow-x-auto rounded-md border border-border bg-card p-4'>
          <table className='text-[10px] text-muted-foreground'>
            <thead>
              <tr>
                <th className='pr-3 text-left font-medium'>combo</th>
                {SIZES.map((size) => (
                  <th
                    key={size}
                    className='px-1 font-medium'
                  >
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMBINATIONS.map((combo) => (
                <tr key={combo.label}>
                  <td className='pr-3 whitespace-nowrap'>{combo.label}</td>
                  {SIZES.map((size) => (
                    <td
                      key={size}
                      className='px-1 pb-2 align-bottom'
                    >
                      <div className={cn('inline-block', boxClass)}>{portrait(size, combo)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
