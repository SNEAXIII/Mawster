'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera } from 'lucide-react'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'
import type { SeasonFormat } from '@/app/services/season'
import AllianceSelect from '@/app/game/_components/alliance-select'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'
import FormatToggle from './format-toggle'

interface DefenseHeaderProps {
  alliances: AllianceWithVisitorFlag[]
  selectedAllianceId: string
  onAllianceChange: (id: string) => void
  selectedBg: number
  onBgChange: (bg: number) => void
  canManage: boolean
  format: SeasonFormat
  onFormatChange: (format: SeasonFormat) => void
  onExportMapClick: () => void
  onExportListClick: () => void
  exporting: boolean
  showBg: boolean
  children?: ReactNode
}

export default function DefenseHeader({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  selectedBg,
  onBgChange,
  canManage,
  format,
  onFormatChange,
  onExportMapClick,
  onExportListClick,
  exporting,
  showBg,
  children,
}: Readonly<DefenseHeaderProps>) {
  const { t } = useI18n()

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex flex-col sm:flex-row sm:flex-wrap gap-3 items-start sm:items-center'>
          {children}

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

          {showBg && (
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium whitespace-nowrap'>
                {t.game.defense.battlegroup}:
              </label>
              <ToggleGroup>
                {[1, 2, 3].map((bg) => (
                  <ToggleButton
                    key={bg}
                    active={selectedBg === bg}
                    onClick={() => onBgChange(bg)}
                    dataCy={`defense-bg-${bg}`}
                  >
                    BG {bg}
                  </ToggleButton>
                ))}
              </ToggleGroup>
            </div>
          )}

          {canManage && (
            <FormatToggle
              value={format}
              onChange={onFormatChange}
            />
          )}

          <div className='ml-auto flex items-center gap-2'>
            {/* Export buttons — available to anyone with access to the alliance */}
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
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
