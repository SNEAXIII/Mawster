'use client'

import RosterChampionCard from '@/app/game/account/_components/roster-champion-card'
import WarStatusBadge from '@/app/game/war/_components/war-status-badge'
import { ROSTER_ENTRIES } from '@/app/dev/_mocks'
import { Section, Variant } from '../_components/showcase-section'

const noop = () => {}
const ACTIONS = { onOpen: noop }

export default function RosterShowcase() {
  return (
    <>
      <Section title='RosterChampionCard — editable (click for actions)'>
        {ROSTER_ENTRIES.map((entry) => (
          <RosterChampionCard
            key={entry.id}
            entry={entry}
            {...ACTIONS}
          />
        ))}
      </Section>

      <Section title='RosterChampionCard — states'>
        <Variant label='read only'>
          <RosterChampionCard
            entry={ROSTER_ENTRIES[0]}
            readOnly
          />
        </Variant>
      </Section>

      <Section title='WarStatusBadge'>
        <WarStatusBadge status='active' />
        <WarStatusBadge status='ended' />
      </Section>
    </>
  )
}
