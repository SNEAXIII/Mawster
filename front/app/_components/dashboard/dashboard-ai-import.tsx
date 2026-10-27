'use client'

import { useEffect, useState } from 'react'
import { HelpCircle, ScanLine } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { type RosterEntry, getRoster } from '@/app/services/roster'
import VisionImportSection from '@/components/roster/vision-import-section'
import { useVisionImportSection } from '@/components/use-vision-import-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// Mount with key={gameAccountId}: the vision hooks keep per-Player state.
export function DashboardAiImport({ gameAccountId }: Readonly<{ gameAccountId: string }>) {
  const { t } = useI18n()
  const [roster, setRoster] = useState<RosterEntry[]>([])

  useEffect(() => {
    getRoster(gameAccountId)
      .then(setRoster)
      .catch((err: unknown) => console.error(err))
  }, [gameAccountId])

  const section = useVisionImportSection({
    roster,
    selectedAccountId: gameAccountId,
    onRosterUpdated: setRoster,
  })

  return (
    <Card data-cy='dashboard-ai-import'>
      <CardContent className='flex flex-col gap-3 p-3 sm:p-4'>
        <h2 className='text-sm font-medium text-muted-foreground'>
          {t.playerDashboard.aiImportTitle}
        </h2>
        <VisionImportSection
          gameAccountId={gameAccountId}
          state={section}
        />
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={section.onVisionClick}
            disabled={section.vision.uploading}
            data-cy='import-vision-button'
          >
            <ScanLine className='mr-1.5 h-3.5 w-3.5' />
            {section.visionLabel}
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={section.howto.reopen}
            aria-label={t.roster.importExport.vision.howto.helpLabel}
            data-cy='vision-howto-help'
          >
            <HelpCircle className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
