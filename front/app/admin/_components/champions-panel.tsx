'use client';
import { type ChangeEvent, useEffect, useState, useCallback, useRef } from 'react';
import {
  getChampions,
  updateChampionAlias,
  deleteChampion,
  loadChampions,
  exportAllChampions,
  toggleChampionAscendable,
  toggleChampionPrefight,
  getSeasonSagaRoles,
  setChampionSagaRole,
  Champion,
  championClasses,
  boolFilterOptions,
} from '@/app/services/champions';
import { listSeasons, getCurrentSeason, type Season } from '@/app/services/season';
import SeasonSelect from '@/app/components/season-select';
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
const BASE_BOOL = 'all';

export default function ChampionsPanel() {
  const { t } = useI18n();

  const [champions, setChampions] = useState<Champion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(BASE_PAGE);
  const [totalPage, setTotalPage] = useState(1);
  const [perPage, setPerPage] = useState(BASE_SIZE);
  const [selectedClass, setSelectedClass] = useState(BASE_CLASS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAscendable, setFilterAscendable] = useState(BASE_BOOL);
  const [filterPrefight, setFilterPrefight] = useState(BASE_BOOL);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canReset, setCanReset] = useState(false);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [sagaRoles, setSagaRoles] = useState<Map<string, { att: boolean; def: boolean }>>(
    new Map()
  );

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
        searchQuery || null,
        filterAscendable,
        filterPrefight
      );
      setChampions(data.champions);
      setCurrentPage(Math.min(currentPage, data.total_pages || 1));
      setTotalPage(data.total_pages);
    } catch (err) {
      setError(
        (err as { status?: number }).status === 401
          ? t.dashboard.errors.unauthorized
          : t.champions.errors.loadError
      );
    } finally {
      setIsLoading(false);
      setCanReset(
        !(
          perPage === BASE_SIZE &&
          selectedClass === BASE_CLASS &&
          searchQuery === '' &&
          filterAscendable === BASE_BOOL &&
          filterPrefight === BASE_BOOL
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, selectedClass, searchQuery, filterAscendable, filterPrefight]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadChampionsList();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, selectedClass, searchQuery, filterAscendable, filterPrefight]);

  useEffect(() => {
    listSeasons()
      .then(async (list) => {
        setSeasons(list);
        const current = await getCurrentSeason();
        setSelectedSeasonId(current?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {
        setError(t.champions.errors.loadError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSeasonId) {
      setSagaRoles(new Map());
      return;
    }
    let ignore = false;
    getSeasonSagaRoles(selectedSeasonId)
      .then((roles) => {
        if (ignore) return;
        const map = new Map<string, { att: boolean; def: boolean }>();
        for (const r of roles) {
          map.set(r.champion_id, { att: r.is_saga_attacker, def: r.is_saga_defender });
        }
        setSagaRoles(map);
      })
      .catch(() => {
        if (!ignore) setError(t.champions.errors.loadError);
      });
    return () => {
      ignore = true;
    };
  }, [selectedSeasonId, t.champions.errors.loadError]);

  function resetPagination() {
    setPerPage(BASE_SIZE);
    setSelectedClass(BASE_CLASS);
    setSearchQuery('');
    setFilterAscendable(BASE_BOOL);
    setFilterPrefight(BASE_BOOL);
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

  async function handleTogglePrefight(champion: Champion) {
    try {
      const result = await toggleChampionPrefight(champion.id);
      setChampions((prev) =>
        prev.map((c) => (c.id === champion.id ? { ...c, has_prefight: result.has_prefight } : c))
      );
    } catch {
      // ignore
    }
  }

  async function handleToggleSagaAttacker(champion: Champion) {
    if (!selectedSeasonId) return;
    const current = sagaRoles.get(champion.id) ?? { att: false, def: false };
    try {
      const result = await setChampionSagaRole(selectedSeasonId, champion.id, {
        is_saga_attacker: !current.att,
        is_saga_defender: current.def,
      });
      setSagaRoles((prev) => {
        const next = new Map(prev);
        next.set(champion.id, { att: result.is_saga_attacker, def: result.is_saga_defender });
        return next;
      });
    } catch {
      setError(t.champions.errors.loadError);
    }
  }

  async function handleToggleSagaDefender(champion: Champion) {
    if (!selectedSeasonId) return;
    const current = sagaRoles.get(champion.id) ?? { att: false, def: false };
    try {
      const result = await setChampionSagaRole(selectedSeasonId, champion.id, {
        is_saga_attacker: current.att,
        is_saga_defender: !current.def,
      });
      setSagaRoles((prev) => {
        const next = new Map(prev);
        next.set(champion.id, { att: result.is_saga_attacker, def: result.is_saga_defender });
        return next;
      });
    } catch {
      setError(t.champions.errors.loadError);
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

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
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
        has_prefight?: boolean;
      }[];
      if (!Array.isArray(data)) throw new Error('Invalid JSON: expected an array');
      await loadChampions(
        data.map((c) => ({
          name: c.name,
          champion_class: c.champion_class,
          image_url: c.image_url ?? null,
          alias: c.alias ?? null,
          is_ascendable: c.is_ascendable,
          has_prefight: c.has_prefight,
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
    <div className='flex flex-col gap-4'>
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
          data-cy='export-champions-btn'
        >
          <Download className='mr-1 size-4' /> {t.champions.exportJson}
        </Button>
        <Button
          variant='outline'
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          data-cy='import-champions-btn'
        >
          <Upload className='mr-1 size-4' />
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

      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap'>
        <DropdownRadioMenu
          labelButton={t.champions.classFilter}
          labelDescription={t.champions.selectClass}
          possibleValues={championClasses.map((c) => ({ value: c.value, label: c.label }))}
          selectedValue={selectedClass}
          showSelected
          setValue={(val) => {
            setSelectedClass(val);
            setCurrentPage(1);
          }}
          data-cy='filter-class'
        />
        <DropdownRadioMenu
          labelButton={t.champions.ascendableFilter}
          labelDescription={t.champions.ascendableFilter}
          possibleValues={boolFilterOptions}
          selectedValue={filterAscendable}
          showSelected
          setValue={(val) => {
            setFilterAscendable(val);
            setCurrentPage(1);
          }}
          data-cy='filter-ascendable'
        />
        <DropdownRadioMenu
          labelButton={t.champions.prefightFilter}
          labelDescription={t.champions.prefightFilter}
          possibleValues={boolFilterOptions}
          selectedValue={filterPrefight}
          showSelected
          setValue={(val) => {
            setFilterPrefight(val);
            setCurrentPage(1);
          }}
          data-cy='filter-prefight'
        />
        <SeasonSelect
          seasons={seasons}
          value={selectedSeasonId}
          onChange={setSelectedSeasonId}
          placeholder={t.champions.sagaSeasonPlaceholder}
          getLabel={(s) => t.champions.seasonLabel.replace('{number}', String(s.number))}
          data-cy='admin-saga-season-select'
        />
        <SearchInput
          placeholder={t.champions.searchPlaceholder}
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          className='w-64'
          data-cy='champion-search'
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
        <div
          className='overflow-x-auto'
          data-cy='champions-list'
        >
          <table className='w-full text-sm border-collapse'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='text-left p-3 w-16'>{t.champions.tableHeaders.image}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.name}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.class}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.alias}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.isAscendable}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.hasPrefight}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.isSagaAttacker}</th>
                <th className='text-left p-3'>{t.champions.tableHeaders.isSagaDefender}</th>
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
                  onTogglePrefight={handleTogglePrefight}
                  onToggleSagaAttacker={handleToggleSagaAttacker}
                  onToggleSagaDefender={handleToggleSagaDefender}
                  sagaAttacker={sagaRoles.get(champion.id)?.att ?? false}
                  sagaDefender={sagaRoles.get(champion.id)?.def ?? false}
                  sagaDisabled={!selectedSeasonId}
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
