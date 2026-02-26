'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RosterGrid from '@/app/game/roster/_components/roster-grid';
import UpgradeRequestsSection from '@/app/game/roster/_components/upgrade-requests-section';
import {
  getRoster,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
} from '@/app/services/roster';
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests';

interface AllianceRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameAccountId: string | null;
  gamePseudo: string;
  /** Whether the viewer can request upgrades (officer/owner) */
  canRequestUpgrade?: boolean;
}

export default function AllianceRosterDialog({
  open,
  onOpenChange,
  gameAccountId,
  gamePseudo,
  canRequestUpgrade = false,
}: AllianceRosterDialogProps) {
  const { t } = useI18n();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    upgradeRequests,
    setUpgradeRequests,
    fetchUpgradeRequests,
    upgradeTarget,
    selectedRarity,
    setSelectedRarity,
    cancelTarget,
    getUpgradeOptions,
    initiateUpgrade,
    handleRequestUpgrade,
    closeUpgradeDialog,
    initiateCancelRequest,
    confirmCancelRequest,
    closeCancelDialog,
  } = useUpgradeRequests();

  useEffect(() => {
    if (!open || !gameAccountId) return;
    setLoading(true);
    setError('');
    Promise.all([
      getRoster(gameAccountId),
      fetchUpgradeRequests(gameAccountId),
    ])
      .then(([rosterData]) => {
        setRoster(rosterData);
      })
      .catch(() => setError(t.game.alliances.rosterError))
      .finally(() => setLoading(false));
  }, [open, gameAccountId]);

  // Group roster by rarity descending
  const groupedRoster = (() => {
    const groups: Record<string, RosterEntry[]> = {};
    for (const rarity of [...RARITIES].reverse()) {
      const entries = roster.filter((r) => r.rarity === rarity);
      if (entries.length > 0) groups[rarity] = entries;
    }
    return Object.entries(groups) as [string, RosterEntry[]][];
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-5xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {t.game.alliances.rosterOf.replace('{pseudo}', gamePseudo)}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <p className="text-gray-500 text-center py-8">
              {t.game.alliances.loadingRoster}
            </p>
          )}

          {error && (
            <p className="text-red-500 text-center py-8">{error}</p>
          )}

          {!loading && !error && roster.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              {t.game.alliances.emptyRoster}
            </p>
          )}

          {!loading && !error && roster.length > 0 && (
            <>
              {canRequestUpgrade && upgradeRequests.length > 0 && (
                <UpgradeRequestsSection
                  gameAccountId={gameAccountId}
                  canCancel={canRequestUpgrade}
                  externalRequests={upgradeRequests}
                  onRequestCancelled={(id) =>
                    setUpgradeRequests((prev) => prev.filter((r) => r.id !== id))
                  }
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

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.game.alliances.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade request sub-dialog */}
      <Dialog
        open={!!upgradeTarget}
        onOpenChange={(v) => { if (!v) closeUpgradeDialog(); }}
      >
        <DialogContent className="w-full max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t.game.alliances.requestUpgradeTitle.replace('{name}', upgradeTarget?.champion_name ?? '')}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600 mb-3">
            {t.game.alliances.requestUpgradeDesc
              .replace('{name}', upgradeTarget?.champion_name ?? '')
              .replace('{current}', RARITY_LABELS[upgradeTarget?.rarity ?? ''] ?? upgradeTarget?.rarity ?? '')}
          </p>

          <Select value={selectedRarity} onValueChange={setSelectedRarity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {upgradeTarget &&
                getUpgradeOptions(upgradeTarget).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RARITY_LABELS[r]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeUpgradeDialog}
            >
              {t.common.cancel}
            </Button>
            <Button onClick={handleRequestUpgrade} disabled={!selectedRarity}>
              {t.game.alliances.requestUpgrade}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel upgrade request confirmation */}
      <ConfirmationDialog
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) closeCancelDialog(); }}
        title={t.roster.upgradeRequests.cancelConfirmTitle}
        description={t.roster.upgradeRequests.cancelConfirmDesc.replace(
          '{name}',
          cancelTarget?.name ?? '',
        )}
        onConfirm={confirmCancelRequest}
        variant="destructive"
        confirmText={t.roster.upgradeRequests.cancel}
      />
    </>
  );
}
