'use client'

import { FiRefreshCw } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import type { GameAccount } from '@/app/services/game'
import NamedSelect from '@/app/game/defense/_components/named-select'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  accounts: GameAccount[]
  selectedId: string
  onSelect: (id: string) => void
  onRefresh: () => void
  refreshDisabled: boolean
}

export function DashboardHeader({
  accounts,
  selectedId,
  onSelect,
  onRefresh,
  refreshDisabled,
}: Readonly<DashboardHeaderProps>) {
  const { t } = useI18n()
  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <h1 className='text-2xl font-bold tracking-tight'>{t.playerDashboard.title}</h1>
      <div className='flex items-center gap-2'>
        <NamedSelect
          items={accounts.map((a) => ({ id: a.id, name: a.game_pseudo }))}
          value={selectedId}
          onChange={onSelect}
          placeholder={t.playerDashboard.pickPlayer}
          dataCy='dashboard-player'
        />
        <Button
          variant='outline'
          size='icon'
          onClick={onRefresh}
          disabled={refreshDisabled}
          aria-label={t.playerDashboard.refresh}
          data-cy='dashboard-refresh'
        >
          <FiRefreshCw className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
