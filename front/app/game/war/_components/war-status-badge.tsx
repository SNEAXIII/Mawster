'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import type { War } from '@/app/services/war'

export default function WarStatusBadge({ status }: Readonly<{ status: War['status'] }>) {
  const { t } = useI18n()

  if (status === 'ended') {
    return (
      <Badge
        variant='secondary'
        data-cy='war-status-ended'
      >
        {t.game.war.statusEnded}
      </Badge>
    )
  }
  return (
    <Badge
      className='bg-blue-600 text-white hover:bg-blue-600'
      data-cy='war-status-active'
    >
      {t.game.war.statusActive}
    </Badge>
  )
}
