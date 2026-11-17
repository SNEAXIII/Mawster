'use client'

import { memo } from 'react'
import { cn } from '@/app/lib/utils'
import ChampionPortrait from '@/components/champion-portrait'
import { type AttackPreference, type RosterEntry, shortenChampionName } from '@/app/services/roster'

interface RosterChampionCardProps {
  entry: RosterEntry
  readOnly?: boolean
  /** Opens the shared champion dialog; ignored on a read-only card */
  onOpen?: (entry: RosterEntry) => void
}

const NAME_STYLE: Record<AttackPreference, { className: string; dataCy?: string }> = {
  preferred: { className: 'text-yellow-400', dataCy: 'preferred-attacker-name' },
  detested: { className: 'text-red-500', dataCy: 'detested-attacker-name' },
  neutral: { className: 'text-foreground' },
}

function RosterChampionCard({
  entry,
  readOnly = false,
  onOpen,
}: Readonly<RosterChampionCardProps>) {
  const nameStyle = NAME_STYLE[entry.attack_preference]
  const cardClass =
    'relative mx-auto flex w-21 flex-col items-center rounded-md bg-card/50 pt-0.5 transition-colors hover:bg-card'

  const content = (
    <>
      {/* Star frame portrait */}
      <ChampionPortrait
        imageUrl={entry.image_url}
        championClass={entry.champion_class}
        name={entry.champion_name}
        rarity={entry.rarity}
        size={72}
        attackPreference={entry.attack_preference}
        ascension={entry.ascension}
        is_saga_attacker={entry.is_saga_attacker}
        is_saga_defender={entry.is_saga_defender}
        sagaMode='all'
      />

      {/* Name */}
      <p
        className={cn(
          '-mt-1 w-full truncate px-1 text-center text-[10px] leading-tight font-semibold',
          nameStyle.className
        )}
        title={entry.champion_name}
        data-cy={nameStyle.dataCy}
      >
        {shortenChampionName(entry.champion_name)}
      </p>

      {/* Signature + ascension */}
      <div className='flex items-center gap-1 pb-0.5 leading-tight'>
        <span
          className={cn(
            'text-[9px] font-semibold tabular-nums',
            entry.signature > 0 ? 'text-amber-400' : 'text-muted-foreground'
          )}
          data-cy='champion-sig'
        >
          {entry.signature}
        </span>
        {entry.ascension > 0 && (
          <span
            className='text-[9px] font-semibold text-purple-400'
            data-cy='champion-ascension'
          >
            A{entry.ascension}
          </span>
        )}
      </div>
    </>
  )

  if (readOnly || !onOpen) {
    return (
      <div
        className={cardClass}
        data-cy={`champion-card-${entry.champion_name}`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type='button'
      className={cn(cardClass, 'cursor-pointer focus-visible:ring-2 focus-visible:ring-ring')}
      onClick={() => onOpen(entry)}
      data-cy={`champion-card-${entry.champion_name}`}
    >
      {content}
    </button>
  )
}

// Memoised: a roster renders hundreds of these, and filtering by name re-runs on
// every keystroke while keeping the surviving entries' object identity.
export default memo(RosterChampionCard)
