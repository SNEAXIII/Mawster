'use client'

import { providerOf, type AvailableAttacker, type Provider } from '@/app/services/war'
import type { CatalogPick } from './use-catalog-picks'
import InfoChampionTile from './info-champion-tile'

interface SynergySelectorGridProps {
  recorded: AvailableAttacker[]
  picks: CatalogPick[]
  onPick: (provider: Provider) => void
}

const cyName = (name: string) => name.replaceAll(/\s+/g, '-')

export default function SynergySelectorGrid({
  recorded,
  picks,
  onPick,
}: Readonly<SynergySelectorGridProps>) {
  return (
    <div className='grid grid-cols-3 gap-2'>
      {recorded.map((a) => (
        <InfoChampionTile
          key={a.champion_user_id}
          champion={a}
          label={a.champion_name}
          badge={a.is_on_defense ? 'on_defense' : undefined}
          dataCy={`synergy-pick-${cyName(a.champion_name)}`}
          onPick={() => onPick(providerOf(a))}
        />
      ))}
      {picks.map((p) => (
        <InfoChampionTile
          key={`unrecorded-${p.game_account_id}-${p.champion_id}`}
          champion={p}
          label={p.champion_name}
          badge='not_in_roster'
          dataCy={`synergy-pick-unrecorded-${cyName(p.champion_name)}`}
          onPick={() => onPick({ champion_id: p.champion_id, game_account_id: p.game_account_id })}
        />
      ))}
    </div>
  )
}
