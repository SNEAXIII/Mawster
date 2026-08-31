import { ATTRIBUTES, attributeIcon } from '@/lib/icons'
import { ATTRIBUTE_KEYS, type AttributeKey, type ChampionAttributes } from '@/lib/types'
import { cn } from '@/lib/cn'

interface AttributeBadgesProps {
  attributes: ChampionAttributes
  iconChoices: Partial<Record<AttributeKey, string>>
  /** Badge height in px — scales with the card so badges stay legible. */
  size: number
  className?: string
}

/**
 * The row of attribute chips drawn under a champion card. `awk` carries the
 * signature level, rendered inside the chip as "x200".
 */
export default function AttributeBadges({
  attributes,
  iconChoices,
  size,
  className,
}: Readonly<AttributeBadgesProps>) {
  const active = ATTRIBUTE_KEYS.filter((key) => attributes.flags[key])
  if (active.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-[2px]', className)}>
      {active.map((key) => {
        const def = ATTRIBUTES[key]
        const Icon = attributeIcon(key, iconChoices[key])
        const value = key === 'awk' && attributes.sig ? `x${attributes.sig}` : null
        return (
          <span
            key={key}
            title={def.code}
            className={cn(
              'inline-flex items-center gap-[1px] rounded-full px-[3px] font-bold leading-none ring-1',
              def.chip
            )}
            style={{ height: size, fontSize: size * 0.62 }}
          >
            <Icon style={{ width: size * 0.72, height: size * 0.72 }} />
            {value && <span className='pr-[1px]'>{value}</span>}
          </span>
        )
      })}
    </div>
  )
}
