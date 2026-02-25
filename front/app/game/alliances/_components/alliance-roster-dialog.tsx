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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RosterGrid from '@/app/game/roster/_components/roster-grid';
import {
  getRoster,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  createUpgradeRequest,
  getNextRarity,
} from '@/app/services/roster';
import { toast } from 'sonner';

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

  // Upgrade request dialog state
  const [upgradeTarget, setUpgradeTarget] = useState<RosterEntry | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string>('');

  useEffect(() => {
    if (!open || !gameAccountId) return;
    setLoading(true);
    setError('');
    getRoster(gameAccountId)
      .then(setRoster)
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

  // Compute available upgrade rarities for a given champion
  const getUpgradeOptions = (entry: RosterEntry) => {
    const current = entry.rarity;
    return RARITIES.filter((r) => r > current);
  };

  const handleRequestUpgrade = async () => {
    if (!upgradeTarget || !selectedRarity) return;
    try {
      await createUpgradeRequest(upgradeTarget.id, selectedRarity);
      toast.success(t.game.alliances.requestUpgradeSuccess);
      setUpgradeTarget(null);
      setSelectedRarity('');
    } catch {
      toast.error(t.game.alliances.requestUpgradeError);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
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
            <RosterGrid
              groupedRoster={groupedRoster}
              readOnly={!canRequestUpgrade}
              onUpgrade={canRequestUpgrade ? (entry) => {
                const options = getUpgradeOptions(entry);
                if (options.length > 0) {
                  setUpgradeTarget(entry);
                  setSelectedRarity(options[0]);
                }
              } : undefined}
            />
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
        onOpenChange={(v) => { if (!v) { setUpgradeTarget(null); setSelectedRarity(''); } }}
      >
        <DialogContent className="max-w-md">
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
              onClick={() => { setUpgradeTarget(null); setSelectedRarity(''); }}
            >
              {t.common.cancel}
            </Button>
            <Button onClick={handleRequestUpgrade} disabled={!selectedRarity}>
              {t.game.alliances.requestUpgrade}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
