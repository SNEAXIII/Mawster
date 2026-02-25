'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  getChampions,
  updateChampionAlias,
  deleteChampion,
  loadChampions,
  exportAllChampions,
  Champion,
  championClasses,
} from '@/app/services/champions';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';
import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { FiDownload, FiUpload } from 'react-icons/fi';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { SearchInput } from '@/components/search-input';
import { ErrorBanner } from '@/components/error-banner';
import ChampionTableRow from './_components/champion-table-row';

const BASE_PAGE = 1;
const BASE_SIZE = 10;
const BASE_CLASS = 'all';



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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canReset, setCanReset] = useState(false);

  // Import/Export
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!sessionReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadChampionsList();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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

  function handleSearchInput(value: string) {
    setSearchInput(value);
    setSearchQuery(value);
    setCurrentPage(1);
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

  async function handleExport() {
    try {
      const data = await exportAllChampions();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `champions_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting champions:', err);
      setError(t.champions.errors.exportError);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { name: string; champion_class: string; image_filename?: string | null }[];
      if (!Array.isArray(data)) throw new Error('Invalid JSON: expected an array');
      const payload = data.map((c) => ({
        name: c.name,
        champion_class: c.champion_class,
        image_filename: c.image_filename ?? null,
      }));
      await loadChampions(payload);
      await loadChampionsList();
    } catch (err) {
      console.error('Error importing champions:', err);
      setError(t.champions.errors.importError);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">

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

      {/* Import/Export row */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExport}>
          <FiDownload className="mr-1" /> {t.champions.exportJson}
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <FiUpload className="mr-1" /> {importing ? t.common.loading : t.champions.importJson}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
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
        <SearchInput
          placeholder={t.champions.searchPlaceholder}
          value={searchInput}
          onChange={handleSearchInput}
          className="w-64"
        />
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} variant="inline" />}

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
                <ChampionTableRow
                  key={champion.id}
                  champion={champion}
                  isEditing={editingId === champion.id}
                  editingAlias={editingAlias}
                  savingAlias={savingAlias}
                  onStartEdit={startEditAlias}
                  onCancelEdit={cancelEditAlias}
                  onSaveAlias={saveAlias}
                  onAliasChange={setEditingAlias}
                  onDelete={setDeleteTarget}
                />
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
