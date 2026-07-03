'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RARITY_LABELS } from '@/app/services/roster';
import type { UpgradeRequestsState } from '@/hooks/use-upgrade-requests';

export default function UpgradeRequestDialogs({
  upgrade,
}: Readonly<{ upgrade: UpgradeRequestsState }>) {
  const { t } = useI18n();
  const {
    upgradeTarget,
    selectedRarity,
    setSelectedRarity,
    getUpgradeOptions,
    handleRequestUpgrade,
    closeUpgradeDialog,
    cancelTarget,
    confirmCancelRequest,
    closeCancelDialog,
  } = upgrade;

  return (
    <>
      <Dialog open={!!upgradeTarget} onOpenChange={(v) => { if (!v) closeUpgradeDialog(); }}>
        <DialogContent className='w-full max-w-[90vw] sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {t.game.alliances.requestUpgradeTitle.replace('{name}', upgradeTarget?.champion_name ?? '')}
            </DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground mb-3'>
            {t.game.alliances.requestUpgradeDesc
              .replace('{name}', upgradeTarget?.champion_name ?? '')
              .replace('{current}', RARITY_LABELS[upgradeTarget?.rarity ?? ''] ?? upgradeTarget?.rarity ?? '')}
          </p>
          <Select value={selectedRarity} onValueChange={setSelectedRarity}>
            <SelectTrigger data-cy='upgrade-rarity-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {upgradeTarget &&
                getUpgradeOptions(upgradeTarget).map((r) => (
                  <SelectItem key={r} value={r}>{RARITY_LABELS[r]}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className='flex justify-end gap-2 pt-2'>
            <Button variant='outline' onClick={closeUpgradeDialog}>{t.common.cancel}</Button>
            <Button data-cy='request-upgrade-btn' onClick={handleRequestUpgrade} disabled={!selectedRarity}>
              {t.game.alliances.requestUpgrade}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) closeCancelDialog(); }}
        title={t.roster.upgradeRequests.cancelConfirmTitle}
        description={t.roster.upgradeRequests.cancelConfirmDesc.replace('{name}', cancelTarget?.name ?? '')}
        onConfirm={confirmCancelRequest}
        variant='destructive'
        confirmText={t.roster.upgradeRequests.cancel}
      />
    </>
  );
}
