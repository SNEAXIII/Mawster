'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import VisionImportBannerActions from './vision-import-banner-actions'
import { useVisionImportBanner, VISION_BANNER_ACTIVE_STATUSES } from './use-vision-import-banner'

interface VisionImportBannerProps {
  gameAccountId: string
  onResume: (importId: string) => void
  // Bumped by the parent whenever it knows the underlying import may have
  // changed outside this component (e.g. confirmed via the review popup).
  refreshSignal?: number
}

// Surfaces the one AI import still awaiting attention on this account, so
// closing the review popup (or the tab) never makes it unreachable. Renders
// nothing when there is none — see getCurrentVisionImport's null-on-204
// contract in app/services/vision.ts.
export default function VisionImportBanner({
  gameAccountId,
  onResume,
  refreshSignal = 0,
}: Readonly<VisionImportBannerProps>) {
  const { t } = useI18n()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { current, busy, cancel, retry } = useVisionImportBanner({ gameAccountId, refreshSignal })

  if (current == null) return null

  const vision = t.roster.importExport.vision
  const title =
    current.status === 'failed'
      ? vision.bannerFailedTitle
      : current.status === 'done'
        ? vision.bannerDoneTitle.replace('{count}', String(current.predictions_count))
        : current.status === 'running'
          ? vision.bannerRunningTitle
              .replace('{done}', String(current.screens_done))
              .replace('{total}', String(current.screens_total))
          : vision.bannerPendingTitle
              .replace('{done}', String(current.screens_done))
              .replace('{total}', String(current.screens_total))

  return (
    <div
      className='mb-4 flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
      data-cy='vision-banner'
    >
      <div className='flex items-center gap-2 text-sm'>
        {current.status === 'failed' && (
          <AlertTriangle className='h-4 w-4 shrink-0 text-destructive' />
        )}
        {VISION_BANNER_ACTIVE_STATUSES.has(current.status) && (
          <Loader2 className='h-4 w-4 shrink-0 animate-spin text-muted-foreground' />
        )}
        <span>{title}</span>
      </div>

      <VisionImportBannerActions
        status={current.status}
        busy={busy}
        onResume={() => onResume(current.id)}
        onRetry={() => void retry()}
        onCancel={() => setConfirmOpen(true)}
      />

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={vision.bannerCancel}
        description={vision.bannerCancelConfirm}
        confirmText={vision.bannerCancel}
        onConfirm={() => void cancel()}
        variant='destructive'
      />
    </div>
  )
}
