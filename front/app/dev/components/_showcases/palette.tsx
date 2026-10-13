'use client'

import { CLASS_ORDER } from '@/app/lib/champion-class'
import { ClassChip } from '@/components/class-chip'
import { Section, Variant } from '../_components/showcase-section'

const PAIRS = [
  'background',
  'card',
  'popover',
  'primary',
  'secondary',
  'muted',
  'accent',
  'destructive',
]
const SINGLES = ['border', 'input', 'ring', 'muted-foreground']

// Hard-coded colours still in the app — they do not follow the tokens (see redesign Q9).
const HARDCODED = [
  { label: 'blue-600 (war active)', className: 'bg-blue-600 text-white' },
  { label: 'blue-400 (edit)', className: 'text-blue-400' },
  { label: 'amber-400 (signature)', className: 'text-amber-400' },
  { label: 'yellow-400 (preferred)', className: 'text-yellow-400' },
  { label: 'purple-400 (ascension)', className: 'text-purple-400' },
  { label: 'green-400 (upgrade)', className: 'text-green-400' },
  { label: 'red-400 (delete)', className: 'text-red-400' },
  { label: 'orange-500 (prefight)', className: 'bg-orange-500 text-white' },
]

export default function PaletteShowcase() {
  return (
    <>
      <Section title='Token pairs — surface / foreground'>
        {PAIRS.map((token) => (
          <Variant
            key={token}
            label={token}
          >
            <div
              className='flex h-16 w-28 items-center justify-center rounded-md border text-lg font-semibold'
              style={{
                background: `hsl(var(--${token}))`,
                color: `hsl(var(--${token === 'background' ? '' : token + '-'}foreground))`,
              }}
            >
              Aa
            </div>
          </Variant>
        ))}
      </Section>

      <Section title='Single tokens'>
        {SINGLES.map((token) => (
          <Variant
            key={token}
            label={token}
          >
            <div
              className='h-16 w-28 rounded-md border'
              style={{ background: `hsl(var(--${token}))` }}
            />
          </Variant>
        ))}
      </Section>

      <Section title='Champion classes (game data, unchanged)'>
        {CLASS_ORDER.map((c) => (
          <ClassChip
            key={c}
            championClass={c}
            variant='pill'
          />
        ))}
      </Section>

      <Section title='Hard-coded colours'>
        {HARDCODED.map(({ label, className }) => (
          <span
            key={label}
            className={`rounded px-2 py-1 text-sm font-semibold ${className}`}
          >
            {label}
          </span>
        ))}
      </Section>
    </>
  )
}
