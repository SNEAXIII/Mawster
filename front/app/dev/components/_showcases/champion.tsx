'use client'

import ChampionPortrait from '@/components/champion-portrait'
import { ClassChip } from '@/components/class-chip'
import { CLASS_ORDER } from '@/app/lib/champion-class'
import { CHAMPIONS } from '@/app/dev/_mocks'
import { Section, Variant } from '../_components/showcase-section'

const [THANOS] = CHAMPIONS
const PORTRAITS = [
  { label: '7r5 plain', rarity: '7r5' },
  { label: '6r5 plain', rarity: '6r5' },
  { label: 'preferred', rarity: '7r5', isPreferred: true },
  { label: 'saga', rarity: '7r5', is_saga_attacker: true },
  { label: 'A2', rarity: '7r5', ascension: 2 },
  { label: 'synergy', rarity: '7r5', mode: 'synergy' },
  { label: 'prefight', rarity: '7r5', mode: 'prefight' },
] as const

export default function ChampionShowcase() {
  return (
    <>
      <Section title='ChampionPortrait — 72px'>
        {PORTRAITS.map(({ label, ...props }) => (
          <Variant
            key={label}
            label={label}
          >
            <ChampionPortrait
              imageUrl={THANOS.imageUrl}
              name={THANOS.name}
              size={72}
              {...props}
            />
          </Variant>
        ))}
      </Section>

      {(['text', 'pill'] as const).map((variant) => (
        <Section
          key={variant}
          title={`ClassChip — ${variant}`}
        >
          {CLASS_ORDER.map((c) => (
            <div
              key={c}
              className='flex flex-col gap-2'
            >
              <ClassChip
                championClass={c}
                variant={variant}
              />
              <ClassChip
                championClass={c}
                variant={variant}
                size='sm'
              />
            </div>
          ))}
        </Section>
      ))}
    </>
  )
}
