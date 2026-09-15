'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = 'all'

type WarOption = { id: string; opponent_name: string }

type WarSelectProps = {
  wars: WarOption[]
  value: string | null
  onChange: (warId: string | null) => void
  /** When set, an "all wars" entry exists and `null` selects it. */
  allLabel?: string
  placeholder?: string
  dataCy: string
  itemDataCy?: string
  className?: string
}

export default function WarSelect({
  wars,
  value,
  onChange,
  allLabel,
  placeholder,
  dataCy,
  itemDataCy = dataCy,
  className = 'w-44',
}: Readonly<WarSelectProps>) {
  const hasAll = allLabel !== undefined
  return (
    <Select
      value={value ?? (hasAll ? ALL : undefined)}
      onValueChange={(v) => onChange(hasAll && v === ALL ? null : v)}
    >
      <SelectTrigger
        className={className}
        data-cy={dataCy}
      >
        <SelectValue placeholder={placeholder ?? allLabel} />
      </SelectTrigger>
      <SelectContent>
        {hasAll && (
          <SelectItem
            value={ALL}
            data-cy={`${itemDataCy}-all`}
          >
            {allLabel}
          </SelectItem>
        )}
        {wars.map((w) => (
          <SelectItem
            key={w.id}
            value={w.id}
            data-cy={`${itemDataCy}-${w.id}`}
          >
            {w.opponent_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
