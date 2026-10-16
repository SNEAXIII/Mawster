'use client'

import ChampionPortrait from '@/components/champion-portrait'
import type { AvailablePrefightAttacker, UnrecordedReason } from '@/app/services/war'
import UnrecordedBadge from './unrecorded-badge'

interface InfoChampionTileProps {
  champion: Pick<
    AvailablePrefightAttacker,
    'champion_name' | 'image_url' | 'is_saga_attacker' | 'is_saga_defender'
  > & { is_preferred_attacker?: boolean }
  label: string
  onPick: () => void
  dataCy: string
  badge?: UnrecordedReason
}

/** A champion picked as information (pre-fight, assist, synergy): its rank does not matter. */
export default function InfoChampionTile({
  champion,
  label,
  onPick,
  dataCy,
  badge,
}: Readonly<InfoChampionTileProps>) {
  return (
    <button
      className='flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:ring-2 hover:ring-primary/60'
      onClick={onPick}
      data-cy={dataCy}
    >
      <ChampionPortrait
        imageUrl={champion.image_url}
        name={champion.champion_name}
        rarity='7r1'
        size={48}
        isPreferred={champion.is_preferred_attacker ?? false}
        is_saga_attacker={champion.is_saga_attacker}
        is_saga_defender={champion.is_saga_defender}
        sagaMode='attacker'
      />
      <span className='text-[10px] text-center truncate w-full leading-tight'>{label}</span>
      {badge && (
        <UnrecordedBadge
          reason={badge}
          compact
        />
      )}
    </button>
  )
}
