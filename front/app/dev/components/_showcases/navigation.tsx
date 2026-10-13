'use client'

import { useState } from 'react'
import TabBar from '@/components/tab-bar'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'
import { CollapsibleSection } from '@/components/collapsible-section'
import { Section, Variant } from '../_components/showcase-section'

const TABS = [
  { value: 'roster', label: 'Roster' },
  { value: 'mastery', label: 'Masteries' },
  { value: 'requests', label: 'Upgrade requests' },
]
const MODES = ['Attack', 'Defense', 'Bans'] as const

export default function NavigationShowcase() {
  const [tab, setTab] = useState('roster')
  const [mode, setMode] = useState<(typeof MODES)[number]>('Attack')

  return (
    <>
      <Section title='TabBar'>
        <TabBar
          tabs={TABS}
          value={tab}
          onChange={setTab}
        />
      </Section>

      <Section title='ToggleButton / ToggleGroup (house)'>
        <ToggleGroup>
          {MODES.map((m) => (
            <ToggleButton
              key={m}
              active={mode === m}
              onClick={() => setMode(m)}
            >
              {m}
            </ToggleButton>
          ))}
        </ToggleGroup>
      </Section>

      <Section title='CollapsibleSection'>
        {[true, false].map((open) => (
          <Variant
            key={String(open)}
            label={open ? 'open' : 'closed'}
          >
            <CollapsibleSection
              title='Battlegroup 2'
              defaultOpen={open}
              className='w-72'
            >
              <p className='text-sm text-muted-foreground'>10 members · 30 defenders</p>
            </CollapsibleSection>
          </Variant>
        ))}
      </Section>
    </>
  )
}
