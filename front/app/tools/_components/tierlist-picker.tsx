'use client'

import { useState } from 'react'

import { Plus, Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useI18n } from '@/app/i18n'
import type { TierListSummary } from '@/app/services/tierlist'

interface TierListPickerProps {
  lists: TierListSummary[]
  activeId: string | null
  /**
   * How many champions the open board holds right now. The count the API sent
   * is a snapshot from load time, so the row being edited would keep showing a
   * stale number until the next reload.
   */
  activeRankedCount: number
  /** Named in the confirmation, so nobody deletes the wrong list. */
  activeTitle: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: () => void
}

/**
 * Which of the account's tier lists is open. Signed out there is nothing to
 * pick — the browser keeps one board — so the whole row is hidden.
 */
export default function TierListPicker({
  lists,
  activeId,
  activeRankedCount,
  activeTitle,
  onSelect,
  onCreate,
  onDelete,
}: Readonly<TierListPickerProps>) {
  const { t } = useI18n()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className='flex items-center gap-2'>
      {lists.length > 0 && (
        <Select
          value={activeId ?? ''}
          onValueChange={onSelect}
        >
          <SelectTrigger
            className='w-56'
            data-cy='tierlist-picker'
          >
            <SelectValue placeholder={t.tierlist.pickList} />
          </SelectTrigger>
          <SelectContent>
            {lists.map((list) => (
              <SelectItem
                key={list.id}
                value={list.id}
              >
                {list.title || t.tierlist.boardTitle} (
                {list.id === activeId ? activeRankedCount : list.ranked_champion_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant='outline'
        size='sm'
        onClick={onCreate}
        data-cy='tierlist-create'
        title={t.tierlist.newList}
      >
        <Plus className='size-4' />
      </Button>
      {/* Deleting the last list would leave the page with nothing to open, so
          the button goes away rather than being disabled with no explanation. */}
      {lists.length > 1 && (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setConfirmingDelete(true)}
          data-cy='tierlist-delete'
          title={t.tierlist.deleteList}
          className='text-muted-foreground hover:text-destructive'
        >
          <Trash2 className='size-4' />
        </Button>
      )}

      <ConfirmationDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t.tierlist.deleteList}
        description={t.tierlist.deleteListConfirm.replace(
          '{title}',
          activeTitle || t.tierlist.boardTitle
        )}
        onConfirm={() => {
          onDelete()
          setConfirmingDelete(false)
        }}
      />
    </div>
  )
}
