'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { getMyGameAccounts, GameAccount } from '@/app/services/game';
import {
  getRoster,
  deleteRosterEntry,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  upgradeChampionRank,
  getNextRarity,
  togglePreferredAttacker,
  ascendChampion,
} from '@/app/services/roster';
import { getMasteries, saveMasteries, MasteryEntry, MasteryUpsertItem } from '@/app/services/masteries';

export enum RosterTab {
  Roster = 'roster',
  Mastery = 'mastery',
  Accounts = 'manage',
}

export function useRosterViewModel() {
  const { status: authStatus } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const initialTab = (searchParams.get('tab') as RosterTab) || RosterTab.Roster;
  const [activeTab, setActiveTab] = useState<RosterTab>(
    Object.values(RosterTab).includes(initialTab) ? initialTab : RosterTab.Roster
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [masteries, setMasteries] = useState<MasteryEntry[]>([]);
  const [masteryForm, setMasteryForm] = useState<MasteryUpsertItem[]>([]);
  const [loadingMasteries, setLoadingMasteries] = useState(false);
  const [savingMasteries, setSavingMasteries] = useState(false);

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEntry, setEditEntry] = useState<RosterEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RosterEntry | null>(null);
  const [upgradeTarget, setUpgradeTarget] = useState<RosterEntry | null>(null);
  const [ascendTarget, setAscendTarget] = useState<RosterEntry | null>(null);
  const [upgradeRefreshKey, setUpgradeRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') redirect('/login');
  }, [authStatus]);

  const fetchAccounts = useCallback(() => {
    setLoadingAccounts(true);
    getMyGameAccounts()
      .then((accs) => {
        setAccounts(accs);
        const primary = accs.find((a) => a.is_primary);
        setSelectedAccountId(primary?.id ?? accs[0]?.id ?? null);
        if (accs.length === 0) setActiveTab(RosterTab.Accounts);
      })
      .catch(() => setError(t.roster.errors.loadAccounts))
      .finally(() => setLoadingAccounts(false));
  }, [t]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  useEffect(() => {
    if (activeTab === RosterTab.Roster && authStatus === 'authenticated') fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!selectedAccountId) { setRoster([]); return; }
    setLoadingRoster(true);
    getRoster(selectedAccountId)
      .then(setRoster)
      .catch(() => setError(t.roster.errors.loadRoster))
      .finally(() => setLoadingRoster(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const fetchMasteries = useCallback(async (accountId: string) => {
    setLoadingMasteries(true);
    try {
      const data = await getMasteries(accountId);
      setMasteries(data);
      setMasteryForm(
        data.map((m) => ({
          mastery_id: m.mastery_id,
          unlocked: m.unlocked,
          attack: m.attack,
          defense: m.defense,
        }))
      );
    } catch {
      // silent — tab shows empty state
    } finally {
      setLoadingMasteries(false);
    }
  }, []);

  const handleSaveMasteries = useCallback(async () => {
    if (!selectedAccountId) return;
    setSavingMasteries(true);
    try {
      const updated = await saveMasteries(selectedAccountId, masteryForm);
      setMasteries(updated);
      toast.success(t.mastery.saveSuccess);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.mastery.saveError);
    } finally {
      setSavingMasteries(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, masteryForm]);

  const handleFormSuccess = useCallback((updated: RosterEntry[]) => {
    setRoster(updated);
    setUpgradeRefreshKey((k) => k + 1);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !selectedAccountId) return;
    const name = deleteTarget.champion_name;
    try {
      await deleteRosterEntry(deleteTarget.id);
      setRoster(await getRoster(selectedAccountId));
      toast.success(t.roster.removeSuccess.replace('{name}', name));
    } catch (e: unknown) {
      const msg = (e as Error).message || t.roster.errors.deleteError;
      toast.error(msg);
      setError(msg);
    } finally {
      setDeleteTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget, selectedAccountId]);

  const startEditEntry = useCallback((entry: RosterEntry) => {
    setEditEntry(entry);
    setShowAddForm(true);
  }, []);

  const confirmUpgrade = useCallback(async () => {
    if (!upgradeTarget || !selectedAccountId) return;
    const nextRarity = getNextRarity(upgradeTarget.rarity);
    if (!nextRarity) return;
    try {
      await upgradeChampionRank(upgradeTarget.id);
      setRoster(await getRoster(selectedAccountId));
      setUpgradeRefreshKey((k) => k + 1);
      toast.success(
        t.roster.upgradeSuccess
          .replace('{name}', upgradeTarget.champion_name)
          .replace('{rarity}', RARITY_LABELS[nextRarity] ?? nextRarity)
      );
    } catch (e: unknown) {
      toast.error((e as Error).message || t.roster.errors.upgradeError);
    } finally {
      setUpgradeTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeTarget, selectedAccountId]);

  const handleTogglePreferredAttacker = useCallback(async (entry: RosterEntry) => {
    try {
      await togglePreferredAttacker(entry.id);
      if (selectedAccountId) setRoster(await getRoster(selectedAccountId));
    } catch (e: unknown) {
      toast.error((e as Error).message || t.roster.preferredAttackerToggle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const confirmAscend = useCallback(async () => {
    if (!ascendTarget || !selectedAccountId) return;
    try {
      await ascendChampion(ascendTarget.id);
      setRoster(await getRoster(selectedAccountId));
      toast.success(t.roster.ascendSuccess.replace('{name}', ascendTarget.champion_name));
    } catch (e: unknown) {
      toast.error((e as Error).message || t.roster.ascendError);
    } finally {
      setAscendTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ascendTarget, selectedAccountId]);

  const groupedRoster = useMemo(() => {
    const groups: Record<string, RosterEntry[]> = {};
    for (const rarity of [...RARITIES].reverse()) {
      const entries = roster.filter((r) => r.rarity === rarity);
      if (entries.length > 0) groups[rarity] = entries;
    }
    return Object.entries(groups);
  }, [roster]);

  useEffect(() => {
    if (activeTab === RosterTab.Mastery && selectedAccountId) {
      fetchMasteries(selectedAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedAccountId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    roster,
    accounts,
    selectedAccountId,
    loadingRoster,
    loadingAccounts,
    error,
    activeTab,
    authStatus,
    groupedRoster,
    showAddForm,
    editEntry,
    deleteTarget,
    upgradeTarget,
    ascendTarget,
    upgradeRefreshKey,
    setSelectedAccountId,
    setActiveTab,
    setDeleteTarget,
    setUpgradeTarget,
    setAscendTarget,
    setShowAddForm,
    startEditEntry,
    confirmDelete,
    confirmUpgrade,
    confirmAscend,
    handleFormSuccess,
    handleTogglePreferredAttacker,
    clearError,
    fetchAccounts,
    masteries,
    masteryForm,
    loadingMasteries,
    savingMasteries,
    setMasteryForm,
    handleSaveMasteries,
  };
}
