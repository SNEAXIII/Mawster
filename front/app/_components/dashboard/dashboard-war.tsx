'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Swords } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { WarProvider, useWar } from '@/app/contexts/war-context'
import { AllianceRoleProvider } from '@/hooks/use-alliance-role'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { Card, CardContent } from '@/components/ui/card'
import type { PlayerDashboardWar } from '@/app/services/player-dashboard'
import type { fightStateFilter } from '@/app/game/war/_components/war-tab'

const WarAttackerPanel = dynamic(() => import('@/app/game/war/_components/war-attacker-panel'), {
  loading: () => <FullPageSpinner />,
})

interface DashboardWarProps {
  allianceId: string
  war: PlayerDashboardWar
  pseudo: string
}

/** The selected Player's fights in the running War, acted on as a plain member. */
export function DashboardWar({ allianceId, war, pseudo }: Readonly<DashboardWarProps>) {
  const { t } = useI18n()

  return (
    <Card data-cy='dashboard-war'>
      <CardContent className='flex flex-col gap-3 p-3 sm:p-4'>
        <h2 className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <Swords className='h-4 w-4' />
          {t.playerDashboard.warTitle.replace('{opponent}', war.opponent_name)}
        </h2>
        <p
          data-cy={war.is_ready ? 'dashboard-war-ready' : 'dashboard-war-not-ready'}
          className={cn(
            'rounded-md px-3 py-2 text-sm',
            war.is_ready ? 'text-xs text-green-500' : 'bg-amber-500/15 font-medium text-amber-500'
          )}
        >
          {war.is_ready ? t.playerDashboard.warReady : t.playerDashboard.warNotReady}
        </p>
        <AllianceRoleProvider>
          <WarProvider
            initialAllianceId={allianceId}
            initialBg={war.battlegroup}
            asPlainMember
          >
            <DashboardWarPanel pseudo={pseudo} />
          </WarProvider>
        </AllianceRoleProvider>
      </CardContent>
    </Card>
  )
}

function DashboardWarPanel({ pseudo }: Readonly<{ pseudo: string }>) {
  const { loading, warLoading, currentWar } = useWar()
  const [playerFilter, setPlayerFilter] = useState(pseudo)
  const [combatFilter, setCombatFilter] = useState<fightStateFilter>('todo')

  // The running War sorts first in the provider's selection, so it is the one on screen.
  if (loading || warLoading || !currentWar) return <FullPageSpinner />

  return (
    <WarAttackerPanel
      playerFilter={playerFilter}
      onPlayerChange={setPlayerFilter}
      combatFilter={combatFilter}
      onCombatFilterChange={setCombatFilter}
      nodeCount={currentWar.node_count}
      maxAttackers={currentWar.max_attackers_per_member}
      format={currentWar.format}
    />
  )
}
