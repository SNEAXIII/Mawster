'use client';

import { useI18n } from '@/app/i18n';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { RARITY_LABELS, getNextRarity, RosterEntry } from '@/app/services/roster';

interface RosterDialogsProps {
  deleteTarget: RosterEntry | null;
  setDeleteTarget: (v: RosterEntry | null) => void;
  confirmDelete: () => Promise<void>;
  upgradeTarget: RosterEntry | null;
  setUpgradeTarget: (v: RosterEntry | null) => void;
  confirmUpgrade: () => Promise<void>;
  ascendTarget: RosterEntry | null;
  setAscendTarget: (v: RosterEntry | null) => void;
  confirmAscend: () => Promise<void>;
}

export function RosterDialogs({
  deleteTarget,
  setDeleteTarget,
  confirmDelete,
  upgradeTarget,
  setUpgradeTarget,
  confirmUpgrade,
  ascendTarget,
  setAscendTarget,
  confirmAscend,
}: Readonly<RosterDialogsProps>) {
  const { t } = useI18n();

  return (
    <>
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.roster.deleteConfirmTitle}
        description={t.roster.deleteConfirmDesc.replace(
          '{name}',
          deleteTarget?.champion_name ?? ''
        )}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={confirmDelete}
        variant='destructive'
      />

      <ConfirmationDialog
        open={upgradeTarget !== null}
        onOpenChange={(open) => !open && setUpgradeTarget(null)}
        title={t.roster.upgradeConfirmTitle}
        description={
          upgradeTarget
            ? t.roster.upgradeConfirmDesc
                .replace('{name}', upgradeTarget.champion_name)
                .replace('{from}', RARITY_LABELS[upgradeTarget.rarity] ?? upgradeTarget.rarity)
                .replace('{to}', RARITY_LABELS[getNextRarity(upgradeTarget.rarity) ?? ''] ?? '')
            : ''
        }
        confirmText={t.roster.upgradeConfirmButton}
        cancelText={t.common.cancel}
        onConfirm={confirmUpgrade}
      />

      <ConfirmationDialog
        open={ascendTarget !== null}
        onOpenChange={(open) => !open && setAscendTarget(null)}
        title={t.roster.ascendConfirmTitle}
        description={
          ascendTarget
            ? t.roster.ascendConfirmDesc
                .replace('{name}', ascendTarget.champion_name)
                .replace('{level}', String((ascendTarget.ascension ?? 0) + 1))
            : ''
        }
        confirmText={t.roster.ascendConfirmButton}
        cancelText={t.common.cancel}
        onConfirm={confirmAscend}
      />
    </>
  );
}
