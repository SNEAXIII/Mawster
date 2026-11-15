'use client'

import type { Ref } from 'react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { useExportMode } from '@/app/contexts/export-mode-context'
import type { CatalogChampion } from '@/app/services/tierlist'
import ChampionThumbnail from '@/components/champion-thumbnail'

interface SagaBoardProps {
  ref: Ref<HTMLDivElement>
  seasonNumber: number
  attackers: CatalogChampion[]
  defenders: CatalogChampion[]
}

/** The capture root for the PNG: the header and both sections, nothing else. */
export default function SagaBoard({
  ref,
  seasonNumber,
  attackers,
  defenders,
}: Readonly<SagaBoardProps>) {
  const { t } = useI18n()
  const exporting = useExportMode()

  return (
    <div
      ref={ref}
      className={cn('flex flex-col gap-6 rounded-lg p-4', exporting ? 'bg-black' : 'bg-background')}
    >
      <h2 className='text-xl font-black'>
        {t.saga.exportTitle.replace('{number}', String(seasonNumber))}
      </h2>
      <SagaSection
        title={t.saga.attackers}
        dataCy='saga-attackers'
        champions={attackers}
      />
      <SagaSection
        title={t.saga.defenders}
        dataCy='saga-defenders'
        champions={defenders}
      />
    </div>
  )
}

function SagaSection({
  title,
  dataCy,
  champions,
}: Readonly<{ title: string; dataCy: string; champions: CatalogChampion[] }>) {
  return (
    <section
      className='flex flex-col gap-3'
      data-cy={dataCy}
    >
      <h3 className='text-sm font-bold uppercase tracking-wide text-muted-foreground'>{title}</h3>
      <ul className='grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3'>
        {champions.map((champion) => (
          <li
            key={champion.id}
            className='flex flex-col items-center gap-1.5 text-center'
            data-cy={`saga-champion-${champion.name}`}
          >
            <ChampionThumbnail
              imageUrl={champion.image_url}
              name={champion.name}
              size={56}
            />
            <span className='text-xs font-semibold'>{champion.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
