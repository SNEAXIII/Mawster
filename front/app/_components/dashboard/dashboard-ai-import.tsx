'use client'

import { useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { type RosterEntry, getRoster } from '@/app/services/roster'
import VisionImportSection from '@/components/roster/vision-import-section'
import { useVisionImportSection } from '@/components/use-vision-import-section'
import { Button } from '@/components/ui/button'

// Mount with key={gameAccountId}: the vision hooks keep per-Player state.
export function DashboardAiImport({ gameAccountId }: Readonly<{ gameAccountId: string }>) {
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
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={section.onVisionClick}
        disabled={section.vision.uploading}
        data-cy='import-vision-button'
      >
        <ScanLine className='h-4 w-4' />
        {section.visionLabel}
      </Button>
      <div className='basis-full empty:hidden'>
        <VisionImportSection
          gameAccountId={gameAccountId}
          state={section}
        />
      </div>
    </>
  )
}
