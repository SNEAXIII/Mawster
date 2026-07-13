'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { getPublicStats, type PublicStats } from '@/app/services/stats'

// Shown while the public stats endpoint loads or if it is unreachable, so the
// strip never collapses to an empty hole on the landing page.
const FALLBACK_STATS: PublicStats = {
  active_alliances: 0,
  participating_players: 0,
  knowledge_base_fights: 0,
  wars_recorded: 0,
}

export function StatStrip() {
  const { t } = useI18n()
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS)

  useEffect(() => {
    getPublicStats().then((s) => {
      if (s) setStats(s)
    })
  }, [])

  const items = [
    { value: stats.active_alliances, label: t.landing.statActiveAlliances },
    { value: stats.participating_players, label: t.landing.statParticipatingPlayers },
    { value: stats.knowledge_base_fights, label: t.landing.statKnowledgeBaseFights },
    { value: stats.wars_recorded, label: t.landing.statWarsRecorded },
  ]

  return (
    <section className='border-y border-border bg-muted/30'>
      <dl className='mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-4'>
        {items.map((s) => (
          <div
            key={s.label}
            className='flex flex-col items-center gap-1 px-4 py-8 text-center'
          >
            <dt className='text-4xl font-bold sm:text-5xl'>{s.value.toLocaleString()}</dt>
            <dd className='max-w-48 text-xs uppercase tracking-wider text-muted-foreground'>
              {s.label}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
