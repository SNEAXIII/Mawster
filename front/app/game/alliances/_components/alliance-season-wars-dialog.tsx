'use client'

import { useI18n } from '@/app/i18n'
import type { SeasonWarStats } from '@/app/services/statistics'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AllianceSeasonWarsTable } from './alliance-season-wars-table'

export function AllianceSeasonWarsDialog({
  open,
  onOpenChange,
  wars,
  allianceTag,
  seasonNumber,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  wars: SeasonWarStats[]
  allianceTag: string
  seasonNumber: number | null
}>) {
  const { t } = useI18n()
  const seasonWars = t.game.alliances.statistics.seasonWars

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className='flex max-h-[90vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0'
        data-cy='season-wars-dialog'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {seasonNumber === null
              ? seasonWars.title
              : `${seasonWars.title} — ${t.game.alliances.statistics.seasonOption.replace(
                  '{number}',
                  String(seasonNumber)
                )}`}
          </DialogTitle>
        </DialogHeader>
        <div className='overflow-y-auto px-6 pb-6'>
          <AllianceSeasonWarsTable
            wars={wars}
            allianceTag={allianceTag}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
