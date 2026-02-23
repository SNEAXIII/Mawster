'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getMyGameAccounts, GameAccount } from '@/app/services/game';
import {
  getRoster,
  searchChampions,
  addChampionToRoster,
  deleteRosterEntry,
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  SIGNATURE_PRESETS,
} from '@/app/services/roster';
import { Champion, getChampionImageUrl } from '@/app/services/champions';
import { FiTrash2, FiPlus, FiSearch } from 'react-icons/fi';

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

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<RosterEntry | null>(null);

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

  const handleAddChampion = useCallback(async () => {
    if (!selectedAccountId || !selectedChampion) return;
    setAdding(true);
    setError(null);
    try {
      await addChampionToRoster(
        selectedAccountId,
        selectedChampion.id,
        selectedRarity,
        signatureValue,
      );
      // Refresh roster
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
      // Reset form
      setSelectedChampion(null);
      setChampionSearch('');
      setSearchResults([]);
      setSelectedRarity(RARITIES[0]);
      setSignatureValue(0);
      setShowAddForm(false);
    } catch (e: any) {
      setError(e.message || t.roster.errors.addError);
    } finally {
      setAdding(false);
    }
  }, [selectedAccountId, selectedChampion, selectedRarity, signatureValue]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !selectedAccountId) return;
    try {
      await deleteRosterEntry(deleteTarget.id);
      const updated = await getRoster(selectedAccountId);
      setRoster(updated);
    } catch (e: any) {
      setError(e.message || t.roster.errors.deleteError);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedAccountId]);

  // Group roster by rarity for display
  const groupedRoster = RARITIES.reduce(
    (acc, rarity) => {
      const entries = roster.filter((r) => r.rarity === rarity);
      if (entries.length > 0) acc[rarity] = entries;
      return acc;
    },
    {} as Record<string, RosterEntry[]>,
  );

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
      <h1 className="text-2xl font-bold mb-4">{t.roster.title}</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {error}
          <button className="ml-2 font-bold" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
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
          {/* Add champion button */}
          <div className="mb-4">
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <FiPlus className="mr-1" />
              {t.roster.addChampion}
            </Button>
          </div>

          {/* Add champion form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 mb-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-3">{t.roster.addChampion}</h3>

              {/* Champion search */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  {t.roster.champion}
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder={t.roster.searchChampion}
                    value={championSearch}
                    onChange={(e) => {
                      setChampionSearch(e.target.value);
                      setSelectedChampion(null);
                    }}
                  />
                </div>

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
                  <div className="mt-1 flex items-center gap-2 text-sm text-green-700">
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
                  onClick={handleAddChampion}
                  disabled={!selectedChampion || adding}
                >
                  {adding ? t.common.loading : t.roster.add}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedChampion(null);
                    setChampionSearch('');
                    setSearchResults([]);
                  }}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          )}

          {/* Roster visualization */}
          {loadingRoster ? (
            <p className="text-gray-500">{t.common.loading}</p>
          ) : roster.length === 0 ? (
            <p className="text-gray-500">{t.roster.empty}</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedRoster).map(([rarity, entries]) => (
                <div key={rarity}>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-sm">
                      {RARITY_LABELS[rarity]}
                    </span>
                    <span className="text-sm text-gray-400">({entries.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow relative group"
                      >
                        <button
                          className="absolute top-1 right-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteTarget(entry)}
                          title={t.common.delete}
                        >
                          <FiTrash2 size={14} />
                        </button>
                        <div className="flex flex-col items-center text-center">
                          {entry.image_url ? (
                            <img
                              src={getChampionImageUrl(entry.image_url, 40) ?? ''}
                              alt={entry.champion_name}
                              className="w-12 h-12 rounded-full object-cover mb-1"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 mb-1 flex items-center justify-center text-gray-400 text-xs">
                              ?
                            </div>
                          )}
                          <p className="text-sm font-medium truncate w-full">
                            {entry.champion_name}
                          </p>
                          <p className="text-xs text-gray-400">{entry.champion_class}</p>
                          {entry.signature > 0 && (
                            <p className="text-xs text-amber-600 font-medium">
                              sig {entry.signature}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
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
    </div>
  );
}
