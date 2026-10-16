import ChampionPortrait from '@/components/champion-portrait'
import type { UnrecordedReason } from '@/app/services/war'
import UnrecordedBadge from './unrecorded-badge'

interface SupportEntry {
  image_url: string | null
  champion_name: string
  rarity: string | null
  ascension: number | null
  is_saga_attacker: boolean
  is_saga_defender: boolean
  unrecorded_reason?: UnrecordedReason | null
}

export default function SupportPortrait({
  entry,
  mode,
  size = 35,
}: Readonly<{ entry: SupportEntry; mode: 'synergy' | 'prefight'; size?: number }>) {
  return (
    <div className='relative flex flex-col items-center'>
      <ChampionPortrait
        imageUrl={entry.image_url}
        name={entry.champion_name}
        rarity={entry.rarity ?? ''}
        size={size}
        mode={mode}
        ascension={entry.ascension ?? 0}
        is_saga_attacker={entry.is_saga_attacker}
        is_saga_defender={entry.is_saga_defender}
        sagaMode='attacker'
      />
      {entry.unrecorded_reason && (
        <UnrecordedBadge
          reason={entry.unrecorded_reason}
          overlay
        />
      )}
    </div>
  )
}
