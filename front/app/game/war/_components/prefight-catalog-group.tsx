'use client'

import { useI18n } from '@/app/i18n'
import { shortenChampionName } from '@/app/services/roster'
import type { CatalogPick } from './use-catalog-picks'
import InfoChampionTile from './info-champion-tile'
import { PickGroup } from './prefight-player-groups'

interface PrefightCatalogGroupProps {
  picks: CatalogPick[]
  pickPlayerFirst: boolean
  onPick: (p: CatalogPick) => void
}

export default function PrefightCatalogGroup({
  picks,
  pickPlayerFirst,
  onPick,
}: Readonly<PrefightCatalogGroupProps>) {
  const { t } = useI18n()
  const u = t.game.war.unrecorded
  if (pickPlayerFirst) {
    return (
      <div
        className='text-center text-sm text-muted-foreground py-4'
        data-cy='prefight-pick-player-first'
      >
        {u.pickPlayerFirst}
      </div>
    )
  }
  if (picks.length === 0) return null
  return (
    <PickGroup title={u.showCatalog}>
      {picks.map((p) => (
        <InfoChampionTile
          key={`unrecorded-${p.game_account_id}-${p.champion_id}`}
          champion={p}
          label={shortenChampionName(p.champion_name)}
          badge='not_in_roster'
          onPick={() => onPick(p)}
          dataCy={`prefight-pick-unrecorded-${p.champion_name.replaceAll(/\s+/g, '-')}`}
        />
      ))}
    </PickGroup>
  )
}
