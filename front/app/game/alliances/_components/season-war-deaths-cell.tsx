'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { Input } from '@/components/ui/input'
import { TableCell } from '@/components/ui/table'

/** Enemy deaths are typed in by hand until defender KOs are tracked, so the cell
 *  doubles as the only way to backfill wars that ended before the field existed. */
export function SeasonWarDeathsCell({
  warId,
  value,
  canEdit,
  onSave,
}: Readonly<{
  warId: string
  value: number | null
  canEdit: boolean
  onSave: (warId: string, deaths: number | null) => Promise<void>
}>) {
  const { t } = useI18n()
  const seasonWars = t.game.alliances.statistics.seasonWars
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const trimmed = draft.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      toast.error(seasonWars.deathsOpponentInvalid)
      return
    }
    setSaving(true)
    try {
      await onSave(warId, parsed)
      setEditing(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <TableCell className='py-1.5 text-right'>
        {value ?? <span className='text-muted-foreground'>—</span>}
      </TableCell>
    )
  }

  if (editing) {
    return (
      <TableCell className='py-1.5 text-right'>
        <Input
          autoFocus
          type='number'
          min='1'
          disabled={saving}
          className='h-7 w-20 text-right'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          data-cy={`season-war-op-input-${warId}`}
        />
      </TableCell>
    )
  }

  return (
    <TableCell className='py-1.5 text-right'>
      <button
        type='button'
        className='inline-flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-muted'
        title={seasonWars.deathsOpponentEdit}
        onClick={() => {
          setDraft(value === null ? '' : String(value))
          setEditing(true)
        }}
        data-cy={`season-war-op-edit-${warId}`}
      >
        {value ?? <span className='text-muted-foreground'>—</span>}
        <Pencil className='size-3 text-muted-foreground' />
      </button>
    </TableCell>
  )
}
