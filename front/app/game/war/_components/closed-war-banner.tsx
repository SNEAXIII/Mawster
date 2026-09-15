'use client'

import { Lock } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ClosedWarBanner() {
  const { t } = useI18n()
  return (
    <Alert
      className='bg-muted/40'
      data-cy='war-closed-banner'
    >
      <Lock className='size-4' />
      <AlertDescription>{t.game.war.closedBanner}</AlertDescription>
    </Alert>
  )
}
