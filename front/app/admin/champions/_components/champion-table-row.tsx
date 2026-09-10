'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { ClassChip } from '@/components/class-chip'
import { ActionIconButton } from '@/components/action-icon-button'
import { type Champion, getChampionImageUrl } from '@/app/services/champions'
import { useI18n } from '@/app/i18n'
import ChampionAttributeToggles from './champion-attribute-toggles'
import type { ChampionAttribute } from '@/app/admin/_viewmodels/champion-attributes'

interface ChampionTableRowProps {
  champion: Champion
  sagaDisabled?: boolean
  onToggleAttribute: (champion: Champion, attribute: ChampionAttribute) => void
  onSaveAlias: (championId: string, alias: string) => Promise<boolean>
  onDelete: (champion: Champion) => void
}

export default function ChampionTableRow({
  champion,
  sagaDisabled,
  onToggleAttribute,
  onSaveAlias,
  onDelete,
}: Readonly<ChampionTableRowProps>) {
  const { t } = useI18n()
  const [isEditing, setIsEditing] = useState(false)
  const [draftAlias, setDraftAlias] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const ok = await onSaveAlias(champion.id, draftAlias)
    setSaving(false)
    if (ok) setIsEditing(false)
  }

  return (
    <tr
      className='border-b hover:bg-accent/50'
      data-cy={`champion-row-${champion.name}`}
    >
      <td className='p-3'>
        {champion.image_url ? (
          <img
            src={getChampionImageUrl(champion.image_url, 40) ?? ''}
            alt={champion.name}
            className='size-10 rounded object-cover'
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className='size-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground'>
            ?
          </div>
        )}
      </td>

      <td className='p-3 font-medium'>{champion.name}</td>

      <td className='p-3'>
        <ClassChip
          championClass={champion.champion_class}
          variant='pill'
        />
      </td>

      <td className='p-3'>
        {isEditing ? (
          <div className='flex items-center gap-1'>
            <Input
              value={draftAlias}
              onChange={(e) => setDraftAlias(e.target.value)}
              placeholder='alias1;alias2;alias3'
              className='h-8 text-sm'
              disabled={saving}
              data-cy='alias-input'
            />
            <Button
              variant='ghost'
              size='sm'
              onClick={save}
              disabled={saving}
              data-cy='save-alias'
            >
              <Check className='text-primary size-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsEditing(false)}
              disabled={saving}
              data-cy='cancel-alias'
            >
              <X className='text-destructive size-4' />
            </Button>
          </div>
        ) : (
          <span className='text-muted-foreground text-xs'>{champion.alias ?? '-'}</span>
        )}
      </td>

      <td className='p-3'>
        <ChampionAttributeToggles
          champion={champion}
          sagaDisabled={sagaDisabled}
          onToggle={onToggleAttribute}
        />
      </td>

      <td className='p-3'>
        <div className='flex items-center gap-1'>
          <ActionIconButton
            icon={<Pencil className='size-3.5' />}
            onClick={() => {
              setDraftAlias(champion.alias ?? '')
              setIsEditing(true)
            }}
            title={t.champions.editAlias}
            data-cy={`edit-alias-${champion.name}`}
          />
          <ActionIconButton
            icon={<Trash2 />}
            onClick={() => onDelete(champion)}
            variant='danger'
            data-cy={`delete-champion-${champion.name}`}
          />
        </div>
      </td>
    </tr>
  )
}
