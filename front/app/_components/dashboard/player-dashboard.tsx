'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { ErrorBanner } from '@/components/error-banner'
import { Button } from '@/components/ui/button'
import { DashboardAiImport } from './dashboard-ai-import'
import { DashboardDefense } from './dashboard-defense'
import { DashboardHeader } from './dashboard-header'
import { DashboardInvitations } from './dashboard-invitations'
import { DashboardLinks } from './dashboard-links'
import { DashboardUpgradeRequests } from './dashboard-upgrade-requests'
import { DashboardWar } from './dashboard-war'
import { usePlayerDashboard } from './use-player-dashboard'

export function PlayerDashboard() {
  const { t } = useI18n()
  const vm = usePlayerDashboard()

  return (
    <div
      className='flex flex-col gap-4'
      data-cy='home-signed-in'
    >
      {vm.accountsLoadError && <ErrorBanner message={t.playerDashboard.loadError} />}
      {!vm.accountsLoading && !vm.accountsLoadError && !vm.selected && (
        <div className='flex flex-col items-center gap-4 py-16 text-center'>
          <p className='text-muted-foreground'>{t.playerDashboard.noPlayer}</p>
          <Button asChild>
            <Link
              href='/game/account'
              data-cy='dashboard-create-player'
            >
              {t.playerDashboard.createPlayer}
              <ArrowRight className='h-4 w-4' />
            </Link>
          </Button>
        </div>
      )}
      {vm.selected && (
        <>
          <DashboardHeader
            accounts={vm.accounts}
            selectedId={vm.selected.id}
            onSelect={vm.selectPlayer}
            onRefresh={vm.refresh}
            refreshDisabled={vm.coolingDown}
          />
          <div className='flex flex-wrap items-center gap-2'>
            <DashboardLinks alliance={vm.dashboard?.alliance ?? null} />
            <DashboardAiImport
              key={vm.selected.id}
              gameAccountId={vm.selected.id}
            />
          </div>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start'>
            <div className='grid min-w-0 flex-1 items-start gap-4 xl:grid-cols-2'>
              {vm.dashboard && (
                <>
                  <DashboardInvitations
                    invitations={vm.dashboard.invitations}
                    onAnswered={vm.afterInvitationAnswered}
                  />
                  <DashboardUpgradeRequests requests={vm.dashboard.upgrade_requests} />
                  <DashboardDefense nodes={vm.dashboard.defense} />
                </>
              )}
            </div>
            {vm.dashboard?.war && vm.dashboard.alliance && (
              <div className='w-full lg:w-92 lg:shrink-0'>
                <DashboardWar
                  refreshKey={vm.refreshKey}
                  allianceId={vm.dashboard.alliance.alliance_id}
                  war={vm.dashboard.war}
                  pseudo={vm.selected.game_pseudo}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
