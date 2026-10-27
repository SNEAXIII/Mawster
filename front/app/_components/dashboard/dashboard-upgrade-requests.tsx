'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { type UpgradeRequest, RARITY_LABELS } from '@/app/services/roster'
import ChampionPortrait from '@/components/champion-portrait'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function DashboardUpgradeRequests({ requests }: Readonly<{ requests: UpgradeRequest[] }>) {
  const { t } = useI18n()
  if (requests.length === 0) return null

  return (
    <Card data-cy='dashboard-upgrade-requests'>
      <CardContent className='flex flex-col gap-3 p-3 sm:p-4'>
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-sm font-medium text-muted-foreground'>
            {t.roster.upgradeRequests.title} ({requests.length})
          </h2>
          <Button
            asChild
            variant='ghost'
            size='sm'
          >
            <Link
              href='/game/account'
              data-cy='dashboard-upgrade-requests-link'
            >
              {t.playerDashboard.openRoster}
              <ArrowRight className='h-4 w-4' />
            </Link>
          </Button>
        </div>
        <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {requests.map((req) => (
            <li
              key={req.id}
              data-cy='dashboard-upgrade-request'
              className='flex items-center gap-3 rounded-md border border-border bg-accent/50 p-2'
            >
              <ChampionPortrait
                imageUrl={req.image_url}
                name={req.champion_name}
                rarity={req.current_rarity}
                size={40}
              />
              <div className='min-w-0 flex-1 text-sm'>
                <p className='truncate font-semibold'>
                  {req.champion_name} →{' '}
                  {RARITY_LABELS[req.requested_rarity] ?? req.requested_rarity}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {t.roster.upgradeRequests.requestedBy.replace('{pseudo}', req.requester_pseudo)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
