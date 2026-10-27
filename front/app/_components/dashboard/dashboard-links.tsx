'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BookUser, Shield, Swords } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import type { PlayerDashboardAlliance } from '@/app/services/player-dashboard'
import { Button } from '@/components/ui/button'

function NavButton({
  href,
  cy,
  children,
}: Readonly<{ href: string; cy: string; children: ReactNode }>) {
  return (
    <Button
      asChild
      variant='outline'
      size='sm'
    >
      <Link
        href={href}
        data-cy={cy}
      >
        {children}
      </Link>
    </Button>
  )
}

export function DashboardLinks({
  alliance,
}: Readonly<{ alliance: PlayerDashboardAlliance | null }>) {
  const { t } = useI18n()
  const query = new URLSearchParams(alliance ? { alliance: alliance.alliance_id } : {})
  if (alliance?.battlegroup) query.set('bg', String(alliance.battlegroup))

  return (
    <>
      <NavButton
        href='/game/account'
        cy='dashboard-go-roster'
      >
        <BookUser className='h-4 w-4' />
        {t.playerDashboard.openRoster}
      </NavButton>
      {alliance && (
        <>
          <NavButton
            href={`/game/war?${query}`}
            cy='dashboard-go-war'
          >
            <Swords className='h-4 w-4' />
            {t.playerDashboard.goToWar}
          </NavButton>
          <NavButton
            href={`/game/defense?${query}`}
            cy='dashboard-go-defense'
          >
            <Shield className='h-4 w-4' />
            {t.playerDashboard.goToDefense}
          </NavButton>
        </>
      )}
    </>
  )
}
