'use client'

import { Eye } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/app/i18n'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'

interface AllianceSelectProps {
  alliances: AllianceWithVisitorFlag[]
  value: string
  onChange: (id: string) => void
  triggerClassName?: string
  placeholder?: string
  dataCy?: string
}

/**
 * Shared alliance picker used across War, Defense, Statistics and Champion search.
 * Renders every alliance as `[TAG] Name` and flags visitor (view-only) alliances
 * with an eye icon, so the selector looks identical on every tab.
 */
export default function AllianceSelect({
  alliances,
  value,
  onChange,
  triggerClassName = 'w-56',
  placeholder,
  dataCy,
}: Readonly<AllianceSelectProps>) {
  const { t } = useI18n()

  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger
        className={triggerClassName}
        data-cy={dataCy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {alliances.map((a) => (
          <SelectItem
            key={a.id}
            value={a.id}
            data-cy={dataCy ? `${dataCy}-item` : undefined}
            data-cy-alliance={a.tag}
          >
            <span className='flex items-center gap-1.5'>
              {a.isVisitor && (
                <Eye
                  className='w-3.5 h-3.5 text-muted-foreground shrink-0'
                  aria-label={t.game.war.viewOnly}
                  data-cy='visitor-eye-icon'
                />
              )}
              [{a.tag}] {a.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
