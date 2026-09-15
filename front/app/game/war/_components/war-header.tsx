'use client'

import { useI18n } from '@/app/i18n'
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector'
import type { War } from '@/app/services/war'
import AllianceSelect from '@/app/game/_components/alliance-select'
import WarSelect from '@/app/game/_components/war-select'

interface WarHeaderProps {
  alliances: AllianceWithVisitorFlag[]
  selectedAllianceId: string
  onAllianceChange: (id: string) => void
  wars: War[]
  selectedWarId: string | null
  onWarChange: (id: string) => void
}

export default function WarHeader({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  wars,
  selectedWarId,
  onWarChange,
}: Readonly<WarHeaderProps>) {
  const { t } = useI18n()

  if (alliances.length <= 1 && wars.length === 0) return null

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {alliances.length > 1 && (
        <AllianceSelect
          alliances={alliances}
          value={selectedAllianceId}
          onChange={onAllianceChange}
          dataCy='alliance-select'
          placeholder={t.game.defense.alliance}
        />
      )}
      {wars.length > 0 && (
        <WarSelect
          wars={wars}
          value={selectedWarId}
          onChange={(id) => id && onWarChange(id)}
          placeholder={t.game.war.selectWar}
          dataCy='war-select'
        />
      )}
    </div>
  )
}
