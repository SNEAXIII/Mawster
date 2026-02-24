'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import ChampionPortrait from '@/components/champion-portrait';
import RosterImportExport from '@/components/roster-import-export';
import { ErrorBanner } from '@/components/error-banner';
import { SearchInput } from '@/components/search-input';
import { CollapsibleSection } from '@/components/collapsible-section';
import { getMyGameAccounts, GameAccount } from '@/app/services/game';
import {
  getRoster,
  searchChampions,
  updateChampionInRoster,
  deleteRosterEntry,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  SIGNATURE_PRESETS,
  raritySortValue,
  getClassColors,
  shortenChampionName,
} from '@/app/services/roster';
import { Champion, getChampionImageUrl } from '@/app/services/champions';
import { FiTrash2, FiChevronDown, FiChevronUp, FiEdit2, FiArrowUp } from 'react-icons/fi';
import {
  upgradeChampionRank,
  getNextRarity,
} from '@/app/services/roster';

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
          {/* Foldable add / update champion section */}
          <div ref={addFormRef} className="mb-6">
            <CollapsibleSection
              title={t.roster.addOrUpdate}
              open={showAddForm}
              onOpenChange={setShowAddForm}
            >
                {/* Champion search */}
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">
                    {t.roster.champion}
                  </label>
                  <SearchInput
                    ref={searchInputRef}
                    placeholder={t.roster.searchChampion}
                    value={championSearch}
                    onChange={(val) => {
                      setChampionSearch(val);
                      setSelectedChampion(null);
                    }}
                  />

                {/* Search results dropdown */}
                {searchResults.length > 0 && !selectedChampion && (
                  <div className="border rounded mt-1 max-h-48 overflow-y-auto bg-white shadow-md">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2"
                        onClick={() => {
                          setSelectedChampion(c);
                          setChampionSearch(c.name);
                          setSearchResults([]);
                        }}
                      >
                        {c.image_url && (
                          <img
                            src={getChampionImageUrl(c.image_url, 40) ?? ''}
                            alt={c.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <span>{c.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{c.champion_class}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedChampion && (
                  <div className="mt-1">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      {selectedChampion.image_url && (
                        <img
                          src={getChampionImageUrl(selectedChampion.image_url, 40) ?? ''}
                          alt={selectedChampion.name}
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <span className="font-medium">{selectedChampion.name}</span>
                      <span className="text-gray-400">({selectedChampion.champion_class})</span>
                    </div>
                    {/* Show existing roster entries for this champion */}
                    {(() => {
                      const existingEntries = roster.filter(
                        (r) => r.champion_id === selectedChampion.id,
                      );
                      if (existingEntries.length === 0) return null;
                      return (
                        <div className="mt-1.5 ml-8 space-y-0.5">
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            {t.roster.alreadyInRoster}
                          </span>
                          {existingEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                            >
                              <span className={"font-semibold text-amber-600 dark:text-amber-400"}>
                                {RARITY_LABELS[entry.rarity] ?? entry.rarity}
                              </span>
                              <span className="text-amber-600 dark:text-amber-400">· sig {entry.signature}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Rarity buttons */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">{t.roster.rarity}</label>
                <div className="flex flex-wrap gap-2">
                  {RARITIES.map((r) => (
                    <button
                      key={r}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        selectedRarity === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedRarity(r)}
                    >
                      {RARITY_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signature field with quick-fill buttons */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t.roster.signature}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={signatureValue}
                    onChange={(e) => setSignatureValue(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <div className="flex gap-1">
                    {SIGNATURE_PRESETS.map((v) => (
                      <button
                        key={v}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          signatureValue === v
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setSignatureValue(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2">
                <Button
                  onClick={handleAddOrUpdateChampion}
                  disabled={!selectedChampion || adding}
                >
                  {adding ? t.common.loading : t.roster.addOrUpdateButton}
                </Button>
              </div>
            </CollapsibleSection>
          </div>

          {/* Roster visualization */}
          {loadingRoster ? (
            <p className="text-gray-500">{t.common.loading}</p>
          ) : roster.length === 0 ? (
            <p className="text-gray-500">{t.roster.empty}</p>
          ) : (
            <div className="space-y-6">
              {groupedRoster.map(([rarity, entries]) => (
                <div key={rarity}>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-gray-800 text-yellow-400 px-3 py-0.5 rounded-md text-sm font-bold">
                      {RARITY_LABELS[rarity]}
                    </span>
                    <span className="text-sm text-gray-400">({entries.length})</span>
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                    {entries.map((entry) => {
                      const classColors = getClassColors(entry.champion_class);
                      return (
                        <div
                          key={entry.id}
                          className={`rounded-md bg-gray-900 ${classColors.border} border-[3px] shadow hover:shadow-lg transition-shadow relative group overflow-hidden`}
                        >
                          {/* Action buttons */}
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            {getNextRarity(entry.rarity) && (
                              <button
                                className="text-green-400 hover:text-green-300 bg-black/60 rounded-full p-1"
                                onClick={() => setUpgradeTarget(entry)}
                                title={t.roster.upgrade}
                              >
                                <FiArrowUp size={14} />
                              </button>
                            )}
                            <button
                              className="text-blue-400 hover:text-blue-300 bg-black/60 rounded-full p-1"
                              onClick={() => startEditEntry(entry)}
                              title="Edit"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              className="text-red-400 hover:text-red-600 bg-black/60 rounded-full p-1"
                              onClick={() => setDeleteTarget(entry)}
                              title={t.common.delete}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>

                          {/* Champion portrait with frame */}
                          <div className="flex justify-center pt-1">
                            <ChampionPortrait
                              imageUrl={entry.image_url}
                              name={entry.champion_name}
                              rarity={entry.rarity}
                              size={72}
                            />
                          </div>

                          {/* Name (shortened) */}
                          <p className="text-[10px] font-semibold text-white text-center truncate px-0.5 mt-0.5" title={entry.champion_name}>
                            {shortenChampionName(entry.champion_name)}
                          </p>

                          {/* Signature */}
                          <div className="flex justify-center pb-1">
                            {entry.signature > 0 ? (
                              <span className="text-amber-400 text-[9px] font-semibold">
                                sig {entry.signature}
                              </span>
                            ) : (
                              <span className="text-white/50 text-[9px]">
                                sig 0
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
