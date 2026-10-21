'use client'

import { useI18n } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const GROUP_OPTIONS = ['1', '2', '3'] as const

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function ChampionSearchGroupSelect({ value, onChange }: Readonly<Props>) {
  const { t } = useI18n()
  const cs = t.game.alliances.championSearch

  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger
        className='h-8 w-28 text-xs'
        data-cy='champion-search-group-select'
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>{cs.allGroups}</SelectItem>
        {GROUP_OPTIONS.map((g) => (
          <SelectItem
            key={g}
            value={g}
          >
            {cs.groupOption.replace('{n}', g)}
          </SelectItem>
        ))}
        <SelectItem value='none'>{cs.noGroup}</SelectItem>
      </SelectContent>
    </Select>
  )
}
