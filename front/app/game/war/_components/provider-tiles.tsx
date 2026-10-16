'use client'

import { shortenChampionName } from '@/app/services/roster'
import { providerOf, type AvailablePrefightAttacker, type Provider } from '@/app/services/war'
import type { CatalogPick } from './use-catalog-picks'
import InfoChampionTile from './info-champion-tile'

const cyName = (name: string) => name.replaceAll(/\s+/g, '-')

/** Recorded copies, then Unrecorded Copies, as pickable tiles. */
export default function ProviderTiles({
  recorded,
  picks,
  cyPrefix,
  onPick,
}: Readonly<{
  recorded: AvailablePrefightAttacker[]
  picks: CatalogPick[]
  cyPrefix: string
  onPick: (provider: Provider) => void
}>) {
  return (
    <>
      {recorded.map((a) => (
        <InfoChampionTile
          key={a.champion_user_id}
          champion={a}
          label={shortenChampionName(a.champion_name)}
          badge={a.is_on_defense ? 'on_defense' : undefined}
          dataCy={`${cyPrefix}-pick-${cyName(a.champion_name)}`}
          onPick={() => onPick(providerOf(a))}
        />
      ))}
      {picks.map((p) => (
        <InfoChampionTile
          key={`unrecorded-${p.game_account_id}-${p.champion_id}`}
          champion={p}
          label={shortenChampionName(p.champion_name)}
          badge='not_in_roster'
          dataCy={`${cyPrefix}-pick-unrecorded-${cyName(p.champion_name)}`}
          onPick={() => onPick({ champion_id: p.champion_id, game_account_id: p.game_account_id })}
        />
      ))}
    </>
  )
}
