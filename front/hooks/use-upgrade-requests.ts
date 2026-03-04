'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  getUpgradeRequests,
  createUpgradeRequest,
  cancelUpgradeRequest,
  UpgradeRequest,
  RARITIES,
  RosterEntry,
} from '@/app/services/roster';

export interface UpgradeRequestsState {
  /** Current list of pending upgrade requests */
  upgradeRequests: UpgradeRequest[];
  /** Set upgrade requests directly (e.g. from initial fetch) */
  setUpgradeRequests: React.Dispatch<React.SetStateAction<UpgradeRequest[]>>;
  /** Load upgrade requests for a game account */
  fetchUpgradeRequests: (gameAccountId: string) => Promise<UpgradeRequest[]>;

  /** Upgrade target for the upgrade dialog */
  upgradeTarget: RosterEntry | null;
  /** Selected rarity for upgrade */
  selectedRarity: string;
  setSelectedRarity: (rarity: string) => void;

  /** Cancel confirmation target */
  cancelTarget: { id: string; name: string } | null;

  /** Get available upgrade options for a roster entry */
  getUpgradeOptions: (entry: RosterEntry) => string[];

  /** Open the upgrade dialog for a roster entry (skips if pending request exists) */
  initiateUpgrade: (entry: RosterEntry) => void;
  /** Submit the upgrade request */
  handleRequestUpgrade: () => Promise<void>;
  /** Close upgrade dialog */
  closeUpgradeDialog: () => void;

  /** Open cancel confirmation for a request (from card or section) */
  initiateCancelRequest: (requestId: string) => void;
  /** Confirm cancel and call API */
  confirmCancelRequest: () => Promise<void>;
  /** Close cancel dialog */
  closeCancelDialog: () => void;

  /** Check if a roster entry has a pending upgrade request */
  hasPendingRequest: (entry: RosterEntry) => boolean;
}

/**
 * Hook that encapsulates all upgrade request state and actions:
 * fetching, creating, cancelling, dialog state, etc.
 *
 * Removes the need to duplicate this logic in every component
 * that interacts with upgrade requests.
 */
export function useUpgradeRequests(): UpgradeRequestsState {
  const { t } = useI18n();

  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [upgradeTarget, setUpgradeTarget] = useState<RosterEntry | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string>('');
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchUpgradeRequests = useCallback(async (gameAccountId: string) => {
    try {
      const data = await getUpgradeRequests(gameAccountId);
      setUpgradeRequests(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const getUpgradeOptions = useCallback((entry: RosterEntry) => {
    return RARITIES.filter((r) => r > entry.rarity);
  }, []);

  const hasPendingRequest = useCallback(
    (entry: RosterEntry) =>
      upgradeRequests.some((r) => r.champion_user_id === entry.id),
    [upgradeRequests],
  );

  const initiateUpgrade = useCallback(
    (entry: RosterEntry) => {
      if (hasPendingRequest(entry)) return;
      const options = getUpgradeOptions(entry);
      if (options.length > 0) {
        setUpgradeTarget(entry);
        setSelectedRarity(options[0]);
      }
    },
    [hasPendingRequest, getUpgradeOptions],
  );

  const closeUpgradeDialog = useCallback(() => {
    setUpgradeTarget(null);
    setSelectedRarity('');
  }, []);

  const handleRequestUpgrade = useCallback(async () => {
    if (!upgradeTarget || !selectedRarity) return;
    try {
      const newReq = await createUpgradeRequest(upgradeTarget.id, selectedRarity);
      setUpgradeRequests((prev) => [...prev, newReq]);
      toast.success(t.game.alliances.requestUpgradeSuccess);
      closeUpgradeDialog();
    } catch {
      toast.error(t.game.alliances.requestUpgradeError);
    }
  }, [upgradeTarget, selectedRarity, closeUpgradeDialog, t]);

  const initiateCancelRequest = useCallback(
    (requestId: string) => {
      const req = upgradeRequests.find((r) => r.id === requestId);
      setCancelTarget({ id: requestId, name: req?.champion_name ?? '' });
    },
    [upgradeRequests],
  );

  const closeCancelDialog = useCallback(() => {
    setCancelTarget(null);
  }, []);

  const confirmCancelRequest = useCallback(async () => {
    if (!cancelTarget) return;
    try {
      await cancelUpgradeRequest(cancelTarget.id);
      setUpgradeRequests((prev) => prev.filter((r) => r.id !== cancelTarget.id));
      toast.success(t.roster.upgradeRequests.cancelSuccess);
    } catch {
      toast.error(t.roster.upgradeRequests.cancelError);
    } finally {
      setCancelTarget(null);
    }
  }, [cancelTarget, t]);

  return {
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
    hasPendingRequest,
  };
}
