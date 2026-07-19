'use client'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'

interface VisionImportBannerActionsProps {
  status: string
  busy: boolean
  onResume: () => void
  onRetry: () => void
  onCancel: () => void
}

// Kept as a sibling of VisionImportBanner purely to stay under the file size
// budget — the three states share this action row, and inlining it pushed
// the parent past 150 lines.
export default function VisionImportBannerActions({
  status,
  busy,
  onResume,
  onRetry,
  onCancel,
}: Readonly<VisionImportBannerActionsProps>) {
  const { t } = useI18n()

  return (
    <div className='flex shrink-0 gap-2'>
      {status === 'done' && (
        <Button
          size='sm'
          onClick={onResume}
          disabled={busy}
          data-cy='vision-banner-resume'
        >
          {t.roster.importExport.vision.bannerResume}
        </Button>
      )}
      {status === 'failed' && (
        <Button
          size='sm'
          variant='outline'
          onClick={onRetry}
          disabled={busy}
          data-cy='vision-banner-retry'
        >
          {t.roster.importExport.vision.bannerRetry}
        </Button>
      )}
      <Button
        size='sm'
        variant='outline'
        onClick={onCancel}
        disabled={busy}
        data-cy='vision-banner-cancel'
      >
        {t.roster.importExport.vision.bannerCancel}
      </Button>
    </div>
  )
}
