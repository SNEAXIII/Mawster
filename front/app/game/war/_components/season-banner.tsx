'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import type { Season } from '@/app/services/season'

interface Props {
  season: Season | null | undefined
}

export default function SeasonBanner({ season }: Readonly<Props>) {
  const { t } = useI18n()

  if (season === undefined) return null

  return (
    <div
      className='flex items-center gap-2'
      data-cy='season-banner'
    >
      {season && season.status === 'active' ? (
        <Badge
          className='bg-green-600 text-white hover:bg-green-600'
          data-cy='season-active-badge'
        >
          {t.game.season.current.replace('{number}', String(season.number))}
        </Badge>
      ) : (
        <Badge
          variant='secondary'
          data-cy='season-pre-season-badge'
        >
          {t.game.season.preSeason}
        </Badge>
      )}
      {season?.format === 'big_thing' && (
        <Badge
          className='bg-amber-600 text-white hover:bg-amber-600'
          data-cy='season-format-banner'
        >
          {t.game.season.format.bigThing}
        </Badge>
      )}
    </div>
  )
}
