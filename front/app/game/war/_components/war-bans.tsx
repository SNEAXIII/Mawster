'use client'

import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'
import ChampionPortrait from '@/components/champion-portrait'

export default function WarBans() {
  const { t } = useI18n()
  const { currentWar } = useWar()
  const bans = currentWar?.banned_champions ?? []

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='shrink-0 text-xs font-medium text-muted-foreground'>
        {t.game.war.bans.label}:
      </span>
      {bans.length === 0 ? (
        <span className='text-xs'>{t.game.war.bans.none}</span>
      ) : (
        bans.map((c) => (
          <div
            key={c.id}
            title={c.name}
            data-cy={`ban-display-${c.id}`}
          >
            <ChampionPortrait
              imageUrl={c.image_url}
              name={c.name}
              rarity={'7r6'}
              size={40}
              is_saga_attacker={c.is_saga_attacker}
              is_saga_defender={c.is_saga_defender}
              sagaMode='attacker'
            />
          </div>
        ))
      )}
    </div>
  )
}
