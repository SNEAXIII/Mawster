'use client'

import { useI18n } from '@/app/i18n'
import { usePublicStats } from '@/app/_viewmodels/use-public-stats'

export function StatStrip() {
  const { t } = useI18n()
  const stats = usePublicStats()

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
