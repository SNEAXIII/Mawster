'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useChunkErrorRecovery } from '@/hooks/use-chunk-error-recovery'
import { useVersionCheck } from '@/hooks/use-version-check'

/**
 * Tells a tab still running an older build that a newer one is deployed.
 * Renders nothing: the toast is the whole UI, and only when the tab is visible
 * — see `useVersionCheck` for why a hidden tab just reloads instead.
 */
export default function VersionWatcher() {
  const { t } = useI18n()

  const promptReload = useCallback(() => {
    toast.info(t.common.newVersion.title, {
      description: t.common.newVersion.description,
      duration: Infinity,
      action: {
        label: t.common.newVersion.action,
        onClick: () => window.location.reload(),
      },
    })
  }, [t])

  useVersionCheck(promptReload)
  useChunkErrorRecovery()

  return null
}
