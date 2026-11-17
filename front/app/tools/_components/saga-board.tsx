'use client'

import type { Ref } from 'react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { shortenChampionName } from '@/app/services/roster'
import { useExportMode } from '@/app/contexts/export-mode-context'
import type { CatalogChampion } from '@/app/services/tierlist'
import ChampionPortrait from '@/components/champion-portrait'

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
      className={cn(
        'flex flex-col gap-6 rounded-lg border border-border p-4',
        // Fixed width while exporting: the PNG holds 10 tiles a row on any screen.
        exporting ? 'w-[61rem] bg-black' : 'bg-linear-to-b from-card to-background'
      )}
    >
      <h2 className='bg-linear-to-b from-yellow-300 to-amber-600 bg-clip-text text-3xl font-black uppercase italic tracking-tight text-transparent'>
        {t.saga.exportTitle.replace('{number}', String(seasonNumber))}
      </h2>
      <SagaSection
        title={t.saga.attackers}
        dataCy='saga-attackers'
        accent='bg-red-500'
        champions={attackers}
      />
      <SagaSection
        title={t.saga.defenders}
        dataCy='saga-defenders'
        accent='bg-sky-500'
        champions={defenders}
      />
    </div>
  )
}

function SagaSection({
  title,
  dataCy,
  accent,
  champions,
}: Readonly<{ title: string; dataCy: string; accent: string; champions: CatalogChampion[] }>) {
  const exporting = useExportMode()

  return (
    <section
      className='flex flex-col gap-3'
      data-cy={dataCy}
    >
      <h3 className='flex items-center gap-2 text-lg font-black uppercase tracking-wide'>
        <span className={cn('h-5 w-1.5 -skew-x-12 rounded-sm', accent)} />
        {title}
        <span className='text-sm font-bold text-muted-foreground'>{champions.length}</span>
      </h3>
      <ul
        className={cn(
          'grid gap-1.5',
          exporting ? 'grid-cols-10' : 'grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))]'
        )}
      >
        {champions.map((champion) => (
          <li
            key={champion.id}
            className='relative flex flex-col items-center rounded-md'
            data-cy={`saga-champion-${champion.name}`}
          >
            <div className='relative py-1'>
              <ChampionPortrait
                imageUrl={champion.image_url}
                championClass={champion.champion_class}
                name={champion.name}
                rarity={champion.is_7_stars_available ? '7r1' : '6r1'}
                size={exporting ? 88 : 72}
                box='frame'
                ascension={champion.is_ascendable ? 1 : 0}
              />
            </div>
            <span
              className='relative flex min-h-8 w-full flex-1 items-center justify-center rounded-b-md bg-black/65 px-1 py-0.5 text-center text-[11px] leading-tight font-bold text-balance break-words uppercase text-white'
              title={champion.name}
            >
              {shortenChampionName(champion.name)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
