'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import ChampionPortrait from '@/components/champion-portrait'
import {
  RosterEntry,
  getClassColors,
  shortenChampionName,
  getNextRarity,
} from '@/app/services/roster'
import { Trash2, Pencil, ArrowUp, X, Star } from 'lucide-react'

interface RosterChampionCardProps {
  entry: RosterEntry
  onEdit?: (entry: RosterEntry) => void
  onDelete?: (entry: RosterEntry) => void
  onUpgrade?: (entry: RosterEntry) => void
  onTogglePreferredAttacker?: (entry: RosterEntry) => void
  onAscend?: (entry: RosterEntry) => void
  readOnly?: boolean
  /** If set, this champion has a pending upgrade request */
  pendingRequestId?: string
  /** Callback to cancel a pending upgrade request */
  onCancelRequest?: (requestId: string) => void
}

/** Action button rendered over the top scrim of the card */
function CardAction({
  className,
  onClick,
  title,
  dataCy,
  children,
}: Readonly<{
  className: string
  onClick: () => void
  title: string
  dataCy?: string
  children: React.ReactNode
}>) {
  return (
    <button
      className={cn('rounded p-0.5 transition-colors', className)}
      onClick={onClick}
      title={title}
      data-cy={dataCy}
    >
      {children}
    </button>
  )
}

export default function RosterChampionCard({
  entry,
  onEdit,
  onDelete,
  onUpgrade,
  onTogglePreferredAttacker,
  onAscend,
  readOnly = false,
  pendingRequestId,
  onCancelRequest,
}: RosterChampionCardProps) {
  const { t } = useI18n()
  const classColors = getClassColors(entry.champion_class)
  const nextRarity = getNextRarity(entry.rarity)

  return (
    <div
      className={cn(
        'group relative mx-auto flex w-21 flex-col items-center rounded-md border bg-card/50 pt-0.5 transition-colors hover:bg-card',
        classColors.border
      )}
      data-cy={`champion-card-${entry.champion_name}`}
    >
      {/* Star frame portrait */}
      <ChampionPortrait
        imageUrl={entry.image_url}
        name={entry.champion_name}
        rarity={entry.rarity}
        size={72}
        isPreferred={entry.is_preferred_attacker}
        ascension={entry.ascension}
        is_saga_attacker={entry.is_saga_attacker}
        is_saga_defender={entry.is_saga_defender}
        sagaMode='all'
      />

      {/* Name */}
      <p
        className={cn(
          '-mt-1 w-full truncate px-1 text-center text-[10px] leading-tight font-semibold',
          entry.is_preferred_attacker ? 'text-yellow-400' : 'text-foreground'
        )}
        title={entry.champion_name}
        data-cy={entry.is_preferred_attacker ? 'preferred-attacker-name' : undefined}
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

      {/* Action bar — always visible on touch, hover on desktop */}
      {!readOnly && (
        <div className='absolute inset-x-0 top-0 z-40 flex justify-end gap-0.5 rounded-t bg-gradient-to-b from-black/85 to-transparent p-0.5 pb-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100'>
          {onTogglePreferredAttacker && (
            <CardAction
              className={
                entry.is_preferred_attacker
                  ? 'text-yellow-400 hover:text-yellow-300'
                  : 'text-white/50 hover:text-yellow-400'
              }
              onClick={() => onTogglePreferredAttacker(entry)}
              title={t.roster.preferredAttackerToggle}
              dataCy='preferred-attacker-toggle'
            >
              <span className='text-xs leading-none'>⚔</span>
            </CardAction>
          )}
          {entry.is_ascendable && entry.ascension < 2 && onAscend && (
            <CardAction
              className='text-purple-400 hover:text-purple-300'
              onClick={() => onAscend(entry)}
              title='Ascension'
            >
              <Star className='size-3.5' />
            </CardAction>
          )}
          {pendingRequestId && onCancelRequest && (
            <CardAction
              className='text-red-400 hover:text-red-300'
              onClick={() => onCancelRequest(pendingRequestId)}
              title={t.roster.upgradeRequests.cancel}
              dataCy='cancel-pending-request'
            >
              <X className='size-3.5' />
            </CardAction>
          )}
          {!pendingRequestId && nextRarity && onUpgrade && (
            <CardAction
              className='text-green-400 hover:text-green-300'
              onClick={() => onUpgrade(entry)}
              title={t.roster.upgrade}
              dataCy='champion-upgrade'
            >
              <ArrowUp className='size-3.5' />
            </CardAction>
          )}
          {onEdit && (
            <CardAction
              className='text-blue-400 hover:text-blue-300'
              onClick={() => onEdit(entry)}
              title='Edit'
              dataCy='champion-edit'
            >
              <Pencil className='size-3.5' />
            </CardAction>
          )}
          {onDelete && (
            <CardAction
              className='text-red-400 hover:text-red-600'
              onClick={() => onDelete(entry)}
              title={t.common.delete}
              dataCy='champion-delete'
            >
              <Trash2 className='size-3.5' />
            </CardAction>
          )}
        </div>
      )}
    </div>
  )
}
