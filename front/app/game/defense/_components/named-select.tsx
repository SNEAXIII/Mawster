'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface NamedSelectItem {
  id: string
  /** Plain name — used for the data-cy suffix, stable regardless of decoration. */
  name: string
  /** What renders inside the option; defaults to `name`. */
  display?: string
}

interface NamedSelectProps {
  items: NamedSelectItem[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  dataCy: string
}

export default function NamedSelect({
  items,
  value,
  onChange,
  placeholder,
  dataCy,
}: Readonly<NamedSelectProps>) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger
        className='w-56'
        data-cy={`${dataCy}-select`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
            data-cy={`${dataCy}-option-${item.name}`}
          >
            {item.display ?? item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
