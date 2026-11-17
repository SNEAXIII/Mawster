'use client'

import type { ReactNode } from 'react'
import { FiArrowUp, FiEdit2, FiStar, FiTrash2, FiX } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ChampionPortrait from '@/components/champion-portrait'
import AscensionRequestButton from '@/components/ascension-request-button'
import AttackPreferencePicker from '@/components/attack-preference-picker'
import {
  type AttackPreference,
  type RosterEntry,
  RARITY_LABELS,
  getNextRarity,
  MAX_ASCENSION,
} from '@/app/services/roster'
export interface RosterChampionActions {
  onEdit?: (entry: RosterEntry) => void
  onDelete?: (entry: RosterEntry) => void
  onUpgrade?: (entry: RosterEntry) => void
  onAttackPreferenceChange?: (entry: RosterEntry, attackPreference: AttackPreference) => void
  onAscend?: (entry: RosterEntry) => void
  /** Callback to cancel a pending upgrade request */
  onCancelRequest?: (requestId: string) => void
}

interface RosterChampionDialogProps extends RosterChampionActions {
  entry: RosterEntry
  /** If set, this champion has a pending upgrade request */
  pendingRequestId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RosterChampionDialog({
  entry,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onUpgrade,
  onAttackPreferenceChange,
  onAscend,
  pendingRequestId,
  onCancelRequest,
}: Readonly<RosterChampionDialogProps>) {
  const { t } = useI18n()
  const nextRarity = getNextRarity(entry.rarity)
  // Every action hands over to its own dialog, so this one closes first.
  const closeThen = (action: () => void) => () => {
    onOpenChange(false)
    action()
  }
  const action = (dataCy: string, onClick: () => void, icon: ReactNode, label: string) => (
    <Button
      variant='outline'
      size='sm'
      onClick={closeThen(onClick)}
      data-cy={dataCy}
    >
      {icon}
      {label}
    </Button>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className='sm:max-w-sm'
        data-cy='champion-dialog'
      >
        <DialogHeader className='flex-row items-center gap-3'>
          <ChampionPortrait
            imageUrl={entry.image_url}
            championClass={entry.champion_class}
            name={entry.champion_name}
            rarity={entry.rarity}
            size={96}
            attackPreference={entry.attack_preference}
            ascension={entry.ascension}
          />
          <div className='flex flex-col gap-1 text-left'>
            <DialogTitle>{entry.champion_name}</DialogTitle>
            <p className='text-sm text-muted-foreground'>
              {RARITY_LABELS[entry.rarity] ?? entry.rarity} · {t.roster.signature} {entry.signature}
              {entry.ascension > 0 && ` · A${entry.ascension}`}
            </p>
          </div>
        </DialogHeader>

        {onAttackPreferenceChange && (
          <AttackPreferencePicker
            value={entry.attack_preference}
            onChange={(pref) => onAttackPreferenceChange(entry, pref)}
          />
        )}

        <div className='flex flex-wrap items-center justify-between gap-2'>
          {pendingRequestId &&
            onCancelRequest &&
            action(
              'cancel-pending-request',
              () => onCancelRequest(pendingRequestId),
              <FiX />,
              t.roster.upgradeRequests.cancel
            )}
          {!pendingRequestId &&
            nextRarity &&
            onUpgrade &&
            action('champion-upgrade', () => onUpgrade(entry), <FiArrowUp />, t.roster.upgrade)}
          {entry.is_ascendable &&
            entry.ascension < MAX_ASCENSION &&
            onAscend &&
            action(
              'champion-ascend',
              () => onAscend(entry),
              <FiStar />,
              t.roster.ascendConfirmButton
            )}
          {!entry.is_ascendable && (
            <AscensionRequestButton
              championId={entry.champion_id}
              variant='text'
            />
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          {onEdit && action('champion-edit', () => onEdit(entry), <FiEdit2 />, t.common.edit)}
          {onDelete &&
            action('champion-delete', () => onDelete(entry), <FiTrash2 />, t.common.delete)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
