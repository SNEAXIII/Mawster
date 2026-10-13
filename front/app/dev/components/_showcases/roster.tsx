'use client'

import RosterChampionCard from '@/app/game/account/_components/roster-champion-card'
import WarStatusBadge from '@/app/game/war/_components/war-status-badge'
import { ROSTER_ENTRIES } from '@/app/dev/_mocks'
import { Section, Variant } from '../_components/showcase-section'

const noop = () => {}
const ACTIONS = {
  onEdit: noop,
  onDelete: noop,
  onUpgrade: noop,
  onTogglePreferredAttacker: noop,
  onAscend: noop,
}

export default function RosterShowcase() {
  return (
    <>
      <Section title='RosterChampionCard — editable (hover for actions)'>
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
        <Variant label='pending upgrade request'>
          <RosterChampionCard
            entry={ROSTER_ENTRIES[2]}
            pendingRequestId='mock-request'
            onCancelRequest={noop}
            {...ACTIONS}
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
