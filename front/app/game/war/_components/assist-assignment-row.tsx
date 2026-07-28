'use client'

import { useI18n } from '@/app/i18n'
import ChampionPortrait from '@/components/champion-portrait'
import { cn } from '@/app/lib/utils'
import { X, Swords, CheckCircle } from 'lucide-react'
import { type WarPlacement } from '@/app/services/war'
import { useWar } from '@/app/contexts/war-context'

interface AssistAssignmentRowProps {
  placement: WarPlacement
  mode?: 'compact' | 'full'
  readonly?: boolean
}

export default function AssistAssignmentRow({
  placement,
  mode = 'compact',
  readonly = false,
}: Readonly<AssistAssignmentRowProps>) {
  const { t } = useI18n()
  const { handleRemoveAssist, handleToggleCombatCompleted, isVisitor } = useWar()

  const isFull = mode === 'full'
  const portraitSize = isFull ? 55 : 40
  const btnSize = isFull ? 'w-7 h-7' : 'w-5 h-5'
  const iconSize = isFull ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
  const boxPaddingSize = isFull ? 'px-7 py-2' : 'px-2 py-1.5'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-amber-950/30 border-amber-800/30',
        boxPaddingSize
      )}
      data-cy={`assist-assignment-node-${placement.node_number}`}
    >
      <div className='flex items-center gap-1 shrink-0'>
        {placement.assistor_image_url ? (
          <ChampionPortrait
            imageUrl={placement.assistor_image_url}
            name={placement.assistor_champion_name ?? ''}
            rarity={placement.assistor_rarity ?? ''}
            size={portraitSize}
            ascension={placement.assistor_ascension ?? 0}
            is_saga_attacker={false}
            is_saga_defender={false}
            sagaMode='attacker'
          />
        ) : (
          <div
            className='rounded shrink-0 bg-muted border border-dashed border-muted-foreground/40'
            style={{ width: portraitSize - 8, height: portraitSize - 8 }}
          />
        )}
        <Swords className={cn('text-amber-500 shrink-0', iconSize)} />
        <ChampionPortrait
          imageUrl={placement.image_url}
          name={placement.champion_name}
          rarity={placement.rarity}
          size={portraitSize}
          ascension={placement.ascension}
          is_saga_attacker={placement.is_saga_attacker}
          is_saga_defender={placement.is_saga_defender}
          sagaMode='defender'
        />
      </div>

      <div className='flex-1 min-w-0'>
        <div className='text-[10px] text-muted-foreground'>
          {t.game.war.assist.for.replace('#{node}', String(placement.node_number))}
        </div>
        <div className='text-[10px] font-medium truncate'>{placement.attacker_pseudo}</div>
      </div>

      {!readonly && !isVisitor && (
        <>
          <button
            type='button'
            className={cn(
              'rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
              placement.is_combat_completed
                ? 'bg-red-700/80 hover:bg-red-700 text-white'
                : 'bg-green-700 text-muted-foreground hover:text-white',
              btnSize
            )}
            onClick={() => handleToggleCombatCompleted(placement.node_number)}
            title={
              placement.is_combat_completed
                ? t.game.war.markCombatUndone
                : t.game.war.markCombatDone
            }
            data-cy={`assist-combat-complete-node-${placement.node_number}`}
          >
            {placement.is_combat_completed ? (
              <X className={cn(iconSize)} />
            ) : (
              <CheckCircle className={cn(iconSize)} />
            )}
          </button>

          <button
            type='button'
            className={cn(
              'rounded-full bg-amber-500/80 hover:bg-amber-500 text-white flex items-center justify-center flex-shrink-0',
              btnSize
            )}
            onClick={() => handleRemoveAssist(placement.node_number)}
            title={t.game.war.assist.revoke}
            data-cy={`remove-assist-assignment-node-${placement.node_number}`}
          >
            <X className={cn(iconSize)} />
          </button>
        </>
      )}
    </div>
  )
}
