'use client'

import { useI18n } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALL_CLASSES_ICON_URL, CLASS_ORDER, sortByClassOrder } from '@/app/lib/champion-class'
import { ClassChip } from '@/components/class-chip'

interface ClassFilterSelectProps {
  /** '' means every class. */
  value: string
  onChange: (value: string) => void
  classes?: readonly string[]
  dataCy: string
}

export default function ClassFilterSelect({
  value,
  onChange,
  classes = CLASS_ORDER,
  dataCy,
}: Readonly<ClassFilterSelectProps>) {
  const { t } = useI18n()

  return (
    <Select
      value={value || 'all'}
      onValueChange={(val) => onChange(val === 'all' ? '' : val)}
    >
      <SelectTrigger
        className='h-8 w-32 text-xs [&>span]:flex'
        data-cy={dataCy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>
          <span className='inline-flex items-center gap-1 text-xs leading-none font-medium'>
            <img
              src={ALL_CLASSES_ICON_URL}
              alt=''
              aria-hidden
              width={14}
              height={14}
              className='shrink-0 object-contain'
            />
            {t.roster.filter.allClasses}
          </span>
        </SelectItem>
        {sortByClassOrder(classes).map((c) => (
          <SelectItem
            key={c}
            value={c}
          >
            <ClassChip championClass={c} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
