'use client'

import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import RosterGrid from '@/app/game/account/_components/roster-grid'
import UpgradeRequestsSection from '@/app/game/account/_components/upgrade-requests-section'
import MasteryMiniView from '@/app/game/account/_components/mastery-mini-view'
import UpgradeRequestDialogs from '@/components/upgrade-request-dialogs'
import { type RosterEntry, RARITIES } from '@/app/services/roster'
import { useMemberRoster } from '../_viewmodels/use-member-roster'
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests'

interface AllianceRosterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameAccountId: string | null
  gamePseudo: string
  /** Whether the viewer can request upgrades (officer/owner) */
  canRequestUpgrade?: boolean
}

export default function AllianceRosterDialog({
  open,
  onOpenChange,
  gameAccountId,
  gamePseudo,
  canRequestUpgrade = false,
}: Readonly<AllianceRosterDialogProps>) {
  const { t } = useI18n()
  const upgrade = useUpgradeRequests()
  const { upgradeRequests, fetchUpgradeRequests, initiateUpgrade, initiateCancelRequest } = upgrade

  const { roster, masteries, loading, error } = useMemberRoster(
    open,
    gameAccountId,
    fetchUpgradeRequests,
    t.game.alliances.rosterError
  )

  // Group roster by rarity descending
  const groupedRoster = (() => {
    const groups: Record<string, RosterEntry[]> = {}
    for (const rarity of [...RARITIES].reverse()) {
      const entries = roster.filter((r) => r.rarity === rarity)
      if (entries.length > 0) groups[rarity] = entries
    }
    return Object.entries(groups) as [string, RosterEntry[]][]
  })()

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent className='w-full max-w-[95vw] sm:max-w-5xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6'>
          <DialogHeader>
            <DialogTitle>{t.game.alliances.rosterOf.replace('{pseudo}', gamePseudo)}</DialogTitle>
          </DialogHeader>

          {loading && (
            <p className='text-muted-foreground text-center py-8'>
              {t.game.alliances.loadingRoster}
            </p>
          )}

          {error && <p className='text-destructive text-center py-8'>{error}</p>}

          {!loading && !error && roster.length === 0 && (
            <p className='text-muted-foreground text-center py-8'>{t.game.alliances.emptyRoster}</p>
          )}

          {!loading && !error && roster.length > 0 && (
            <>
              {canRequestUpgrade && upgradeRequests.length > 0 && (
                <UpgradeRequestsSection
                  gameAccountId={gameAccountId}
                  canCancel={canRequestUpgrade}
                  requests={upgradeRequests}
                  onInitiateCancel={initiateCancelRequest}
                />
              )}
              <RosterGrid
                groupedRoster={groupedRoster}
                readOnly={!canRequestUpgrade}
                upgradeRequests={upgradeRequests}
                onCancelRequest={canRequestUpgrade ? initiateCancelRequest : undefined}
                onUpgrade={canRequestUpgrade ? initiateUpgrade : undefined}
              />
            </>
          )}

          {!loading && masteries.length > 0 && (
            <div className='mt-4 border-t pt-4 flex justify-center'>
              <MasteryMiniView
                masteries={masteries}
                defaultMode='all'
              />
            </div>
          )}

          <div className='flex justify-end pt-2'>
            <Button
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t.game.alliances.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeRequestDialogs upgrade={upgrade} />
    </>
  )
}
