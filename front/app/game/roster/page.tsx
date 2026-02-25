'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import RosterImportExport from '@/components/roster-import-export';
import { ErrorBanner } from '@/components/error-banner';
import { getMyGameAccounts, GameAccount } from '@/app/services/game';
import {
  getRoster,
  searchChampions,
  updateChampionInRoster,
  deleteRosterEntry,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  upgradeChampionRank,
  getNextRarity,
} from '@/app/services/roster';
import { Champion } from '@/app/services/champions';

import AddChampionForm from './_components/add-champion-form';
import RosterGrid from './_components/roster-grid';

export default function RosterPage() {
  const { data: session, status: authStatus } = useSession();
  const { t } = useI18n();

  // Game accounts
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Roster
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Add champion form
  const [showAddForm, setShowAddForm] = useState(false);
  const [championSearch, setChampionSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Champion[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string>(RARITIES[0]);
  const [signatureValue, setSignatureValue] = useState<number>(0);
  const [adding, setAdding] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<RosterEntry | null>(null);

  // Upgrade
  const [upgradeTarget, setUpgradeTarget] = useState<RosterEntry | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Auth redirect
  useEffect(() => {
    if (authStatus === 'unauthenticated') redirect('/login');
  }, [authStatus]);

  // Load accounts
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    setLoadingAccounts(true);
    getMyGameAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length === 1) {
          setSelectedAccountId(accs[0].id);
        }
      })
      .catch(() => setError(t.roster.errors.loadAccounts))
      .finally(() => setLoadingAccounts(false));
  }, [authStatus]);

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

  // Champion search with debounce
  useEffect(() => {
    if (!championSearch.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchChampions(championSearch, 10);
        setSearchResults(res.champions);
      } catch {
        // ignore search errors
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [championSearch]);

  // Auto-focus search input when add form opens
  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showAddForm]);

  const handleAddOrUpdateChampion = useCallback(async () => {
    if (!selectedAccountId || !selectedChampion) return;
    setAdding(true);
    setError(null);
    try {
      await updateChampionInRoster(
        selectedAccountId,
        selectedChampion.id,
        selectedRarity,
        signatureValue,
      );
      // Refresh roster
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      toast.success(t.roster.addSuccess.replace('{name}', selectedChampion.name));
      // Reset champion selection but keep the form open
      setSelectedChampion(null);
      setChampionSearch('');
      setSearchResults([]);
      setSignatureValue(0);
      // Re-focus search input for quick next add
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e.message || t.roster.errors.addError);
      setError(e.message || t.roster.errors.addError);
    } finally {
      setAdding(false);
    }
  }, [selectedAccountId, selectedChampion, selectedRarity, signatureValue]);

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

  // Pre-fill the add form with an existing roster entry for quick editing
  const startEditEntry = useCallback((entry: RosterEntry) => {
    // Find the champion in search results or create a minimal object
    const champion: Champion = {
      id: entry.champion_id,
      name: entry.champion_name,
      champion_class: entry.champion_class,
      image_url: entry.image_url,
      is_7_star: entry.rarity.startsWith('7'),
      alias: null,
    };
    setSelectedChampion(champion);
    setChampionSearch(entry.champion_name);
    setSelectedRarity(entry.rarity);
    setSignatureValue(entry.signature);
    setShowAddForm(true);
    setTimeout(() => {
      addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const confirmUpgrade = useCallback(async () => {
    if (!upgradeTarget || !selectedAccountId) return;
    const nextRarity = getNextRarity(upgradeTarget.rarity);
    if (!nextRarity) return;
    setUpgrading(true);
    try {
      await upgradeChampionRank(upgradeTarget.id);
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      toast.success(
        t.roster.upgradeSuccess
          .replace('{name}', upgradeTarget.champion_name)
          .replace('{rarity}', RARITY_LABELS[nextRarity] ?? nextRarity),
      );
    } catch (e: any) {
      toast.error(e.message || t.roster.errors.upgradeError);
    } finally {
      setUpgrading(false);
      setUpgradeTarget(null);
    }
  }, [upgradeTarget, selectedAccountId]);

  // Group roster by rarity, sorted descending (7r5 first → 6r4 last)
  const groupedRoster = (() => {
    const groups: Record<string, RosterEntry[]> = {};
    for (const rarity of [...RARITIES].reverse()) {
      const entries = roster.filter((r) => r.rarity === rarity);
      if (entries.length > 0) groups[rarity] = entries;
    }
    return Object.entries(groups) as [string, RosterEntry[]][];
  })();

  if (authStatus === 'loading' || loadingAccounts) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{t.roster.title}</h1>
        <p className="text-gray-500">{t.roster.noAccounts}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t.roster.title}</h1>
        {selectedAccountId && (
          <RosterImportExport
            roster={roster}
            selectedAccountId={selectedAccountId}
            selectedAccountName={accounts.find((a) => a.id === selectedAccountId)?.game_pseudo ?? ''}
            onRosterUpdated={setRoster}
          />
        )}
      </div>

      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />
      )}

      {/* Account selector - only show if multiple accounts */}
      {accounts.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">{t.roster.selectAccount}</label>
          <select
            className="border rounded px-3 py-2 w-full max-w-xs"
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value || null)}
          >
            <option value="">{t.roster.chooseAccount}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.game_pseudo} {acc.is_primary ? `(${t.game.accounts.primary})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedAccountId && (
        <>
          <AddChampionForm
            open={showAddForm}
            onOpenChange={setShowAddForm}
            championSearch={championSearch}
            onChampionSearchChange={(val) => {
              setChampionSearch(val);
              setSelectedChampion(null);
            }}
            searchResults={searchResults}
            selectedChampion={selectedChampion}
            onSelectChampion={(c) => {
              setSelectedChampion(c);
              setChampionSearch(c.name);
              setSearchResults([]);
            }}
            selectedRarity={selectedRarity}
            onRarityChange={setSelectedRarity}
            signatureValue={signatureValue}
            onSignatureChange={setSignatureValue}
            adding={adding}
            onSubmit={handleAddOrUpdateChampion}
            roster={roster}
            searchInputRef={searchInputRef}
            formRef={addFormRef}
          />

          {loadingRoster ? (
            <p className="text-gray-500">{t.common.loading}</p>
          ) : (
            <RosterGrid
              groupedRoster={groupedRoster}
              onEdit={startEditEntry}
              onDelete={setDeleteTarget}
              onUpgrade={setUpgradeTarget}
            />
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.roster.deleteConfirmTitle}
        description={t.roster.deleteConfirmDesc.replace(
          '{name}',
          deleteTarget?.champion_name ?? '',
        )}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={confirmDelete}
        variant="destructive"
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
    </div>
  );
}
