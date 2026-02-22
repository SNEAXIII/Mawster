'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  getChampions,
  updateChampionAlias,
  deleteChampion,
  Champion,
  championClasses,
} from '@/app/services/champions';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';
import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { FiCheck, FiEdit2, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { ConfirmationDialog } from '@/components/confirmation-dialog';

const BASE_PAGE = 1;
const BASE_SIZE = 10;
const BASE_CLASS = 'all';

// Map champion class to a color
const classColors: Record<string, string> = {
  Science: 'bg-green-100 text-green-800',
  Cosmic: 'bg-purple-100 text-purple-800',
  Mutant: 'bg-yellow-100 text-yellow-800',
  Skill: 'bg-red-100 text-red-800',
  Tech: 'bg-blue-100 text-blue-800',
  Mystic: 'bg-pink-100 text-pink-800',
};

export default function ChampionsPage() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    if (status === 'authenticated') setSessionReady(true);
  }, [status]);

  const [champions, setChampions] = useState<Champion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(BASE_PAGE);
  const [totalPage, setTotalPage] = useState(1);
  const [perPage, setPerPage] = useState(BASE_SIZE);
  const [selectedClass, setSelectedClass] = useState(BASE_CLASS);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [canReset, setCanReset] = useState(false);

  // Alias editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Champion | null>(null);

  const loadChampionsList = useCallback(async () => {
    setError('');
    if (!champions.length) setIsLoading(true);
    try {
      const data = await getChampions(
        Math.max(currentPage, 1),
        perPage,
        selectedClass,
        searchQuery || null,
      );
      setChampions(data.champions);
      setCurrentPage(Math.min(currentPage, data.total_pages || 1));
      setTotalPage(data.total_pages);
    } catch (err) {
      console.error('Error loading champions:', err);
      if ((err as any).status === 401) {
        setError(t.dashboard.errors.unauthorized);
      } else {
        setError(t.champions.errors.loadError);
      }
    } finally {
      setIsLoading(false);
      setCanReset(!(perPage === BASE_SIZE && selectedClass === BASE_CLASS && searchQuery === ''));
    }
  }, [currentPage, perPage, selectedClass, searchQuery, sessionReady]);

  useEffect(() => {
    if (sessionReady) loadChampionsList();
  }, [sessionReady, currentPage, perPage, selectedClass, searchQuery]);

  function resetPagination() {
    setPerPage(BASE_SIZE);
    setSelectedClass(BASE_CLASS);
    setSearchQuery('');
    setSearchInput('');
    setCurrentPage(BASE_PAGE);
  }

  function handleClassChange(value: string) {
    setSelectedClass(value);
    setCurrentPage(1);
  }

  function handlePerPageChange(value: string) {
    setPerPage(Number(value));
    setCurrentPage(1);
  }

  function handleSearch() {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  // Alias editing
  function startEditAlias(champion: Champion) {
    setEditingId(champion.id);
    setEditingAlias(champion.alias || '');
  }

  function cancelEditAlias() {
    setEditingId(null);
    setEditingAlias('');
  }

  async function saveAlias(championId: string) {
    setSavingAlias(true);
    try {
      await updateChampionAlias(championId, editingAlias || null);
      setEditingId(null);
      await loadChampionsList();
    } catch (err) {
      console.error('Error saving alias:', err);
    } finally {
      setSavingAlias(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteChampion(deleteTarget.id);
      setDeleteTarget(null);
      await loadChampionsList();
    } catch (err) {
      console.error('Error deleting champion:', err);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.champions.title}</h1>

      {/* Controls row */}
      <div className="flex flex-col lg:flex-row gap-3">
        <PaginationControls
          currentPage={currentPage}
          totalPage={totalPage}
          usersPerPage={perPage}
          canReset={canReset}
          onUserPerPageChange={handlePerPageChange}
          onFirstPage={() => setCurrentPage(1)}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => p + 1)}
          onLastPage={() => setCurrentPage(totalPage)}
          onResetPagination={resetPagination}
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <DropdownRadioMenu
          labelButton={t.champions.classFilter}
          labelDescription={t.champions.selectClass}
          possibleValues={championClasses.map((c) => ({ value: c.value, label: c.label }))}
          selectedValue={selectedClass}
          setValue={handleClassChange}
        />
        <div className="flex gap-2">
          <Input
            placeholder={t.champions.searchPlaceholder}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-64"
          />
          <Button variant="outline" onClick={handleSearch}>
            <FiSearch />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-500 text-sm py-2">{error}</div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8">{t.common.loading}</div>
      ) : champions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t.champions.empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 w-16">{t.champions.tableHeaders.image}</th>
                <th className="text-left p-3">{t.champions.tableHeaders.name}</th>
                <th className="text-left p-3">{t.champions.tableHeaders.class}</th>
                <th className="text-left p-3">{t.champions.tableHeaders.alias}</th>
                <th className="text-left p-3 w-24">{t.champions.tableHeaders.actions}</th>
              </tr>
            </thead>
            <tbody>
              {champions.map((champion) => (
                <tr key={champion.id} className="border-b hover:bg-gray-50">
                  {/* Image */}
                  <td className="p-3">
                    {champion.image_url ? (
                      <img
                        src={`/api/back${champion.image_url}`}
                        alt={champion.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        ?
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="p-3 font-medium">{champion.name}</td>

                  {/* Class */}
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        classColors[champion.champion_class] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {champion.champion_class}
                    </span>
                  </td>

                  {/* Alias */}
                  <td className="p-3">
                    {editingId === champion.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingAlias}
                          onChange={(e) => setEditingAlias(e.target.value)}
                          placeholder="alias1;alias2;alias3"
                          className="h-8 text-sm"
                          disabled={savingAlias}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveAlias(champion.id)}
                          disabled={savingAlias}
                        >
                          <FiCheck className="text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditAlias}
                          disabled={savingAlias}
                        >
                          <FiX className="text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-xs">
                          {champion.alias || '-'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditAlias(champion)}
                        >
                          <FiEdit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(champion)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t.champions.deleteConfirmTitle}
        description={t.champions.deleteConfirmDesc.replace(
          '{name}',
          deleteTarget?.name || '',
        )}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
