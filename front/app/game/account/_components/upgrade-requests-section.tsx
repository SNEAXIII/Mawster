'use client'

import { useI18n } from '@/app/i18n'
import { CollapsibleSection } from '@/components/collapsible-section'
import ChampionPortrait from '@/components/champion-portrait'
import { type UpgradeRequest, RARITY_LABELS } from '@/app/services/roster'
import { getClassColors } from '@/app/lib/champion-class'
import { X } from 'lucide-react'

interface UpgradeRequestsSectionProps {
  gameAccountId: string | null
  requests: UpgradeRequest[]
  /** Whether the current user can cancel requests (officer/owner) */
  canCancel?: boolean
  /** Opens the cancel confirmation owned by the upgrade requests hook */
  onInitiateCancel: (requestId: string) => void
}

export default function UpgradeRequestsSection({
  gameAccountId,
  requests,
  canCancel = true,
  onInitiateCancel,
}: Readonly<UpgradeRequestsSectionProps>) {
  const { t } = useI18n()

  // Don't render at all if no requests
  if (!gameAccountId || requests.length === 0) return null

  return (
    <div data-cy='upgrade-requests-section'>
      <CollapsibleSection
        title={`${t.roster.upgradeRequests.title} (${requests.length})`}
        defaultOpen={false}
        className='mb-4'
      >
        <div className='flex flex-col gap-2'>
          {requests.map((req) => {
            const classColors = getClassColors(req.champion_class)
            return (
              <div
                key={req.id}
                data-cy='upgrade-request-item'
                className={`flex items-center gap-3 p-2 rounded-md bg-card ${classColors.border} border`}
              >
                <ChampionPortrait
                  imageUrl={req.image_url}
                  name={req.champion_name}
                  rarity={req.current_rarity}
                  size={40}
                />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-semibold text-white truncate'>{req.champion_name}</p>
                  <div className='flex items-center gap-2 text-xs'>
                    <span className='text-muted-foreground'>
                      {t.roster.upgradeRequests.currentRarity.replace(
                        '{rarity}',
                        RARITY_LABELS[req.current_rarity] ?? req.current_rarity
                      )}
                    </span>
                    <span className='text-yellow-400 font-semibold'>
                      → {RARITY_LABELS[req.requested_rarity] ?? req.requested_rarity}
                    </span>
                  </div>
                  <p className='text-[10px] text-muted-foreground'>
                    {t.roster.upgradeRequests.requestedBy.replace('{pseudo}', req.requester_pseudo)}
                  </p>
                </div>
                {canCancel && (
                  <button
                    data-cy='cancel-upgrade-request'
                    className='text-destructive hover:text-destructive/80 bg-black/40 rounded-full p-1 shrink-0'
                    onClick={() => onInitiateCancel(req.id)}
                    title={t.roster.upgradeRequests.cancel}
                  >
                    <X className='size-3.5' />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>
    </div>
  )
}
