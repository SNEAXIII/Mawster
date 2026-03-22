'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import RosterImportExport from '@/components/roster-import-export';
import { ErrorBanner } from '@/components/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

import { AllianceRoleProvider, useAllianceRole } from '@/hooks/use-alliance-role';
import TabBar, { type TabItem } from '@/components/tab-bar';
import GameAccountsSection from '@/components/profile/game-accounts-section';
import AddChampionForm from './add-champion-form';
import RosterGrid from './roster-grid';
import UpgradeRequestsSection from './upgrade-requests-section';

export enum RosterTab {
  Roster = 'roster',
  Accounts = 'accounts',
}

/** Sub-component that uses the AllianceRoleProvider to determine canCancel */
function RosterUpgradeSection({
  selectedAccountId,
  allianceId,
  refreshKey,
}: Readonly<{
  selectedAccountId: string | null;
  allianceId: string | null;
  refreshKey: number;
}>) {
  const { getRoleFor } = useAllianceRole();
  const role = allianceId ? getRoleFor(allianceId) : undefined;
  return (
    <UpgradeRequestsSection
      gameAccountId={selectedAccountId}
      refreshKey={refreshKey}
      canCancel={role?.can_manage ?? false}
    />
  );
}

export default function RosterContent() {
  const { status: authStatus } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Game accounts
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Tabs — read from URL or default
  const initialTab = (searchParams.get('tab') as RosterTab) || RosterTab.Roster;
  const [activeTab, setActiveTab] = useState<RosterTab>(
    Object.values(RosterTab).includes(initialTab) ? initialTab : RosterTab.Roster
  );

  // Sync tab to URL
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab]);

  // Roster
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Add champion form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEntry, setEditEntry] = useState<RosterEntry | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<RosterEntry | null>(null);

  // Upgrade
  const [upgradeTarget, setUpgradeTarget] = useState<RosterEntry | null>(null);

  // Ascend
  const [ascendTarget, setAscendTarget] = useState<RosterEntry | null>(null);

  // Upgrade requests refresh key
  const [upgradeRefreshKey, setUpgradeRefreshKey] = useState(0);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Auth redirect
  useEffect(() => {
    if (authStatus === 'unauthenticated') redirect('/login');
  }, [authStatus]);

  // Load accounts
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
  }, [authStatus]);

  // Re-fetch accounts when switching to Roster tab
  useEffect(() => {
    if (activeTab === RosterTab.Roster && authStatus === 'authenticated') {
      fetchAccounts();
    }
  }, [activeTab]);

  // Load roster when account changes
  useEffect(() => {
    if (!selectedAccountId) {
      setRoster([]);
      return;
    }
    setLoadingRoster(true);
    getRoster(selectedAccountId)
      .then(setRoster)
      .catch(() => setError(t.roster.errors.loadRoster))
      .finally(() => setLoadingRoster(false));
  }, [selectedAccountId]);

  const handleFormSuccess = useCallback((updated: RosterEntry[]) => {
    setRoster(updated);
    setUpgradeRefreshKey((k) => k + 1);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !selectedAccountId) return;
    const name = deleteTarget.champion_name;
    try {
      await deleteRosterEntry(deleteTarget.id);
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      toast.success(t.roster.removeSuccess.replace('{name}', name));
    } catch (e: any) {
      toast.error(e.message || t.roster.errors.deleteError);
      setError(e.message || t.roster.errors.deleteError);
    } finally {
      setDeleteTarget(null);
    }
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
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      setUpgradeRefreshKey((k) => k + 1);
      toast.success(
        t.roster.upgradeSuccess
          .replace('{name}', upgradeTarget.champion_name)
          .replace('{rarity}', RARITY_LABELS[nextRarity] ?? nextRarity)
      );
    } catch (e: any) {
      toast.error(e.message || t.roster.errors.upgradeError);
    } finally {
      setUpgradeTarget(null);
    }
  }, [upgradeTarget, selectedAccountId]);

  const handleTogglePreferredAttacker = useCallback(
    async (entry: RosterEntry) => {
      try {
        await togglePreferredAttacker(entry.id);
        if (selectedAccountId) {
          const updated = await getRoster(selectedAccountId);
          setRoster(updated);
        }
      } catch (e: any) {
        toast.error(e.message || t.roster.preferredAttackerToggle);
      }
    },
    [selectedAccountId]
  );

  const confirmAscend = useCallback(async () => {
    if (!ascendTarget || !selectedAccountId) return;
    try {
      await ascendChampion(ascendTarget.id);
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      toast.success(t.roster.ascendSuccess.replace('{name}', ascendTarget.champion_name));
    } catch (e: any) {
      toast.error(e.message || t.roster.ascendError);
    } finally {
      setAscendTarget(null);
    }
  }, [ascendTarget, selectedAccountId]);

  // Group roster by rarity, sorted descending (7r5 first → 6r4 last)
  const groupedRoster = (() => {
    const groups: Record<string, RosterEntry[]> = {};
    for (const rarity of [...RARITIES].reverse()) {
      const entries = roster.filter((r) => r.rarity === rarity);
      if (entries.length > 0) groups[rarity] = entries;
    }
    return Object.entries(groups);
  })();

  if (authStatus === 'loading' || loadingAccounts) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>{t.common.loading}</p>
      </div>
    );
  }

  const tabs: TabItem<RosterTab>[] = [
    ...(accounts.length > 0
      ? [{ value: RosterTab.Roster, label: t.roster.title, cy: 'tab-roster' }]
      : []),
    { value: RosterTab.Accounts, label: t.nav.gameAccounts, cy: 'tab-accounts' },
  ];

  return (
    <AllianceRoleProvider>
      <div className='px-3 py-4 sm:p-6 max-w-6xl mx-auto'>
        <TabBar
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Roster tab */}
        {activeTab === RosterTab.Roster && (
          <>
            {accounts.length === 0 ? (
              <p className='text-muted-foreground'>{t.roster.noAccounts}</p>
            ) : (
              <>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2'>
                  {accounts.length > 1 && (
                    <div className='mb-6'>
                      <label className='block text-sm font-medium mb-2'>
                        {t.roster.selectAccount}
                      </label>
                      <Select
                        value={selectedAccountId || ''}
                        onValueChange={(val) => setSelectedAccountId(val || null)}
                      >
                        <SelectTrigger
                          className='w-full max-w-xs'
                          data-cy='roster-account-select'
                        >
                          <SelectValue placeholder={t.roster.chooseAccount} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem
                              key={acc.id}
                              value={acc.id}
                            >
                              {acc.game_pseudo}{' '}
                              {acc.is_primary ? `(${t.game.accounts.primary})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {selectedAccountId && (
                    <RosterImportExport
                      roster={roster}
                      selectedAccountId={selectedAccountId}
                      selectedAccountName={
                        accounts.find((a) => a.id === selectedAccountId)?.game_pseudo ?? ''
                      }
                      onRosterUpdated={(updated) => {
                        setRoster(updated);
                        setUpgradeRefreshKey((k) => k + 1);
                      }}
                    />
                  )}
                </div>

                {error && (
                  <ErrorBanner
                    message={error}
                    onDismiss={() => setError(null)}
                    className='mb-4'
                  />
                )}

                {selectedAccountId && (
                  <>
                    <AddChampionForm
                      open={showAddForm}
                      onOpenChange={setShowAddForm}
                      selectedAccountId={selectedAccountId}
                      roster={roster}
                      initialEntry={editEntry}
                      onSuccess={handleFormSuccess}
                    />

                    <RosterUpgradeSection
                      selectedAccountId={selectedAccountId}
                      allianceId={
                        accounts.find((a) => a.id === selectedAccountId)?.alliance_id ?? null
                      }
                      refreshKey={upgradeRefreshKey}
                    />

                    {loadingRoster ? (
                      <p className='text-muted-foreground'>{t.common.loading}</p>
                    ) : (
                      <RosterGrid
                        groupedRoster={groupedRoster}
                        onEdit={startEditEntry}
                        onDelete={setDeleteTarget}
                        onUpgrade={setUpgradeTarget}
                        onTogglePreferredAttacker={handleTogglePreferredAttacker}
                        onAscend={setAscendTarget}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Accounts tab */}
        {activeTab === RosterTab.Accounts && (
          <GameAccountsSection onAccountsChange={fetchAccounts} />
        )}

        {/* Delete confirmation dialog */}
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

        {/* Upgrade confirmation dialog */}
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

        {/* Ascension confirmation dialog */}
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
      </div>
    </AllianceRoleProvider>
  );
}
