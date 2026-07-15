'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type DefenseSummary } from '@/app/services/defense'
import { Trash2, Camera } from 'lucide-react'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'
import AllianceSelect from '@/app/game/_components/alliance-select'

interface DefenseHeaderProps {
  alliances: AllianceWithVisitorFlag[]
  selectedAllianceId: string
  onAllianceChange: (id: string) => void
  selectedBg: number
  onBgChange: (bg: number) => void
  onClearClick: () => void
  canManage: boolean
  defenseSummary: DefenseSummary | null
  onExportMapClick: () => void
  onExportListClick: () => void
  exporting: boolean
}

export default function DefenseHeader({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  selectedBg,
  onBgChange,
  onClearClick,
  canManage,
  defenseSummary,
  onExportMapClick,
  onExportListClick,
  exporting,
}: Readonly<DefenseHeaderProps>) {
  const { t } = useI18n()

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
          {/* Alliance selector */}
          {alliances.length > 1 && (
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium whitespace-nowrap'>
                {t.game.defense.alliance}:
              </label>
              <AllianceSelect
                alliances={alliances}
                value={selectedAllianceId}
                onChange={onAllianceChange}
                dataCy='defense-alliance-select'
              />
            </div>
          )}

          {/* BG selector */}
          <div className='flex flex-wrap items-center gap-2'>
            <label className='text-sm font-medium whitespace-nowrap'>
              {t.game.defense.battlegroup}:
            </label>
            <div className='flex gap-1'>
              {[1, 2, 3].map((bg) => (
                <Button
                  key={bg}
                  variant={selectedBg === bg ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onBgChange(bg)}
                  data-cy={`defense-bg-${bg}`}
                >
                  BG {bg}
                </Button>
              ))}
            </div>
          </div>

          <div className='ml-auto flex items-center gap-2'>
            {/* Export buttons — managers only, one image per click */}
            {canManage && (
              <>
                <Button
                  variant='outline'
                  size='sm'
                  data-cy='defense-export-map-btn'
                  onClick={onExportMapClick}
                  disabled={exporting}
                  title={t.game.defense.exportMap}
                >
                  <Camera className='w-4 h-4 mr-1' />
                  {exporting ? '…' : t.game.defense.exportMap}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  data-cy='defense-export-list-btn'
                  onClick={onExportListClick}
                  disabled={exporting}
                  title={t.game.defense.exportList}
                >
                  <Camera className='w-4 h-4 mr-1' />
                  {exporting ? '…' : t.game.defense.exportList}
                </Button>
              </>
            )}
            {/* Clear — managers only */}
            {canManage && defenseSummary && defenseSummary.placements.length > 0 && (
              <Button
                variant='destructive'
                size='sm'
                data-cy='defense-clear-all'
                onClick={onClearClick}
              >
                <Trash2 className='w-4 h-4 mr-1' />
                {t.game.defense.clearAll}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
