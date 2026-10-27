'use client'

import { useI18n } from '@/app/i18n'
import type { DefensePlanNode } from '@/app/services/defense'
import ChampionPortrait from '@/components/champion-portrait'
import { Card, CardContent } from '@/components/ui/card'

export function DashboardDefense({ nodes }: Readonly<{ nodes: DefensePlanNode[] }>) {
  const { t } = useI18n()
  if (nodes.length === 0) return null

  return (
    <Card data-cy='dashboard-defense'>
      <CardContent className='flex flex-col gap-3 p-3 sm:p-4'>
        <h2 className='text-sm font-medium text-muted-foreground'>
          {t.playerDashboard.defenseTitle} ({nodes.length})
        </h2>
        <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {[...nodes]
            .sort((a, b) => a.node_number - b.node_number)
            .map((node) => (
              <li
                key={node.id}
                data-cy={`dashboard-defense-node-${node.node_number}`}
                className='flex items-center gap-3 rounded-md border border-border bg-accent/50 p-2'
              >
                <ChampionPortrait
                  imageUrl={node.champion_image_url}
                  name={node.champion_name}
                  rarity={node.rarity ?? ''}
                  size={40}
                />
                <div className='min-w-0 flex-1 text-sm'>
                  <p className='truncate font-semibold'>{node.champion_name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {t.playerDashboard.node.replace('{node}', String(node.node_number))}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  )
}
