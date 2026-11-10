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
import type { TierListSummary } from '../_lib/lists'

interface TierListPickerProps {
  lists: TierListSummary[]
  activeId: string | null
  /**
   * The open board's count and title right now. The summaries are read when the
   * lists load, so the row being edited would otherwise show stale ones.
   */
  activeRankedCount: number
  activeTitle: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: () => void
}

/** Which of the browser's tier lists is open. */
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
            {lists.map((list) => {
              const active = list.id === activeId
              return (
                <SelectItem
                  key={list.id}
                  value={list.id}
                >
                  {(active ? activeTitle : list.title) || t.tierlist.boardTitle} (
                  {active ? activeRankedCount : list.ranked_champion_count})
                </SelectItem>
              )
            })}
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
