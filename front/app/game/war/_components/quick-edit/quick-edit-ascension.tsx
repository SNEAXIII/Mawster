'use client'

import { useI18n } from '@/app/i18n'
import LabeledSlider from '@/components/labeled-slider'
import AscensionRequestButton from '@/components/ascension-request-button'
import type { Champion } from '@/app/services/champions'
import { cn } from '@/app/lib/utils'
import type { Draft } from './quick-edit-logic'

interface QuickEditAscensionProps {
  node: number
  value: Draft | null
  champion?: Champion
  ascendable: boolean
  ascension: number
  locked: boolean
  onEdit: (draft: Draft) => void
}

export default function QuickEditAscension({
  node,
  value,
  champion,
  ascendable,
  ascension,
  locked,
  onEdit,
}: Readonly<QuickEditAscensionProps>) {
  const { t } = useI18n()

  if (champion && !ascendable) {
    return (
      <div className='w-20'>
        <AscensionRequestButton
          championId={champion.id}
          variant='icon'
        />
      </div>
    )
  }

  // Hidden, not removed, so the columns of every row stay aligned.
  return (
    <LabeledSlider
      max={2}
      value={[ascension]}
      onChange={([next]) => value && onEdit({ ...value, ascension: next })}
      format={(a) => (a === 0 ? t.game.war.ascensionNone : `A${a}`)}
      cy={`war-quick-edit-asc-${node}`}
      disabled={locked || !ascendable}
      className={cn('w-20', !ascendable && 'invisible')}
      title={t.game.war.ascension}
    />
  )
}
