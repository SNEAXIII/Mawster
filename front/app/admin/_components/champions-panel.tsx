'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  getChampions,
  updateChampionAlias,
  deleteChampion,
  loadChampions,
  exportAllChampions,
  toggleChampionAscendable,
  Champion,
  championClasses,
} from '@/app/services/champions';
import PaginationControls from '@/components/dashboard/pagination/pagination-controls';
import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import { Download, Upload } from 'lucide-react';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { SearchInput } from '@/components/search-input';
import { ErrorBanner } from '@/components/error-banner';
import ChampionTableRow from '@/app/admin/champions/_components/champion-table-row';

const BASE_PAGE = 1;
const BASE_SIZE = 10;
const BASE_CLASS = 'all';

export default function ChampionsPanel() {
  const { t } = useI18n();

  const [champions, setChampions] = useState<Champion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(BASE_PAGE);
  const [totalPage, setTotalPage] = useState(1);
  const [perPage, setPerPage] = useState(BASE_SIZE);
  const [selectedClass, setSelectedClass] = useState(BASE_CLASS);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canReset, setCanReset] = useState(false);

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Champion | null>(null);

  const loadChampionsList = useCallback(async () => {
    setError('');
    if (!champions.length) setIsLoading(true);
    try {
      const data = await getChampions(
        Math.max(currentPage, 1),
        perPage,
        selectedClass,
        searchQuery || null
      );
      setChampions(data.champions);
      setCurrentPage(Math.min(currentPage, data.total_pages || 1));
      setTotalPage(data.total_pages);
    } catch (err) {
      setError(
        (err as { status?: number }).status === 401 ? t.dashboard.errors.unauthorized : t.champions.errors.loadError
      );
    } finally {
      setIsLoading(false);
      setCanReset(!(perPage === BASE_SIZE && selectedClass === BASE_CLASS && searchQuery === ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, selectedClass, searchQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadChampionsList();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, selectedClass, searchQuery]);

  function resetPagination() {
    setPerPage(BASE_SIZE);
    setSelectedClass(BASE_CLASS);
    setSearchQuery('');
    setCurrentPage(BASE_PAGE);
  }

  async function saveAlias(championId: string) {
    setSavingAlias(true);
    try {
      await updateChampionAlias(championId, editingAlias || null);
      setEditingId(null);
      await loadChampionsList();
    } catch {
      // ignore
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
    } catch {
      // ignore
    }
  }

  async function handleToggleAscendable(champion: Champion) {
    try {
      const result = await toggleChampionAscendable(champion.id);
      setChampions((prev) =>
        prev.map((c) => (c.id === champion.id ? { ...c, is_ascendable: result.is_ascendable } : c))
      );
    } catch {
      // ignore
    }
  }

  async function handleExport() {
    try {
      const data = await exportAllChampions();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `champions_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.champions.errors.exportError);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const data = JSON.parse(await file.text()) as {
        name: string;
        champion_class: string;
        image_url?: string | null;
        alias?: string | null;
        is_ascendable?: boolean;
      }[];
      if (!Array.isArray(data)) throw new Error('Invalid JSON: expected an array');
      await loadChampions(
        data.map((c) => ({
          name: c.name,
          champion_class: c.champion_class,
          image_url: c.image_url ?? null,
          alias: c.alias ?? null,
          is_ascendable: c.is_ascendable ?? false,
        }))
      );
      await loadChampionsList();
    } catch {
      setError(t.champions.errors.importError);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col lg:flex-row gap-3'>
        <PaginationControls
          currentPage={currentPage}
          totalPage={totalPage}
          usersPerPage={perPage}
          canReset={canReset}
          onUserPerPageChange={(val) => {
            setPerPage(Number(val));
            setCurrentPage(1);
          }}
          onFirstPage={() => setCurrentPage(1)}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => p + 1)}
          onLastPage={() => setCurrentPage(totalPage)}
          onResetPagination={resetPagination}
        />
      </div>

      <div className='flex gap-2'>
        <Button
          variant='outline'
          onClick={handleExport}
        >
          <Download className='mr-1 h-4 w-4' /> {t.champions.exportJson}
        </Button>
        <Button
          variant='outline'
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <Upload className='mr-1 h-4 w-4' />{' '}
          {importing ? t.common.loading : t.champions.importJson}
        </Button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.json'
          className='hidden'
          onChange={handleImport}
        />
      </div>

      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
        <DropdownRadioMenu
          labelButton={t.champions.classFilter}
          labelDescription={t.champions.selectClass}
          possibleValues={championClasses.map((c) => ({ value: c.value, label: c.label }))}
          selectedValue={selectedClass}
          setValue={(val) => {
            setSelectedClass(val);
            setCurrentPage(1);
          }}
        />
        <SearchInput
          placeholder={t.champions.searchPlaceholder}
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          className='w-64'
        />
      </div>

      {error && (
        <ErrorBanner
          message={error}
          variant='inline'
        />
      )}

      {isLoading ? (
        <div className='text-center py-8'>{t.common.loading}</div>
      ) : champions.length === 0 ? (
        <div className='text-center py-8 text-muted-foreground'>{t.champions.empty}</div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm border-collapse'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='text-left p-3 w-16'>{t.champions.tableHeaders.image}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.name}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.class}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.alias}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.isAscendable}</th>
                <th className='text-left p-3 w-24'>{t.champions.tableHeaders.actions}</th>
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
                  onStartEdit={(c) => {
                    setEditingId(c.id);
                    setEditingAlias(c.alias || '');
                  }}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setEditingAlias('');
                  }}
                  onSaveAlias={saveAlias}
                  onAliasChange={setEditingAlias}
                  onDelete={setDeleteTarget}
                  onToggleAscendable={handleToggleAscendable}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t.champions.deleteConfirmTitle}
        description={t.champions.deleteConfirmDesc.replace('{name}', deleteTarget?.name || '')}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={confirmDelete}
        variant='destructive'
      />
    </div>
  );
}
