'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { getClassColors, shortenChampionName } from '@/app/services/roster';
import { type WarPlacement } from '@/app/services/war';
import { Separator } from '@/components/ui/separator';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import AttackerEntryRow from './attacker-entry-row';

const PROXY = '/api/back';

interface ChampionEntry {
  id: string;
  name: string;
  champion_class: string;
  image_url: string | null;
  is_ascendable: boolean;
}

interface SelectedRarity {
  stars: number;
  rank: number;
}

const WAR_RARITIES: { label: string; stars: number; rank: number }[] = [
  { label: '6★R4', stars: 6, rank: 4 },
  { label: '6★R5', stars: 6, rank: 5 },
  { label: '7★R1', stars: 7, rank: 1 },
  { label: '7★R2', stars: 7, rank: 2 },
  { label: '7★R3', stars: 7, rank: 3 },
  { label: '7★R4', stars: 7, rank: 4 },
  { label: '7★R5', stars: 7, rank: 5 },
];

interface WarChampionSelectorProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  placedChampionIds: Set<string>;
  currentPlacement?: WarPlacement;
  onSelect: (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => void;
}

export default function WarChampionSelector({
  open,
  onClose,
  nodeNumber,
  placedChampionIds,
  currentPlacement,
  onSelect,
}: WarChampionSelectorProps) {
  const { t } = useI18n();
  const [champions, setChampions] = useState<ChampionEntry[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<ChampionEntry | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<SelectedRarity>({ stars: 7, rank: 3 });
  const [ascension, setAscension] = useState(0);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchChampions = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: '60' });
      if (q) params.set('search', q);
      const res = await fetch(`${PROXY}/champions?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setChampions(p === 1 ? data.champions : (prev) => [...prev, ...data.champions]);
      setTotalPages(data.total_pages);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchChampions(search, 1);
    }
  }, [open, search, fetchChampions]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSearch('');
      setPage(1);
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleChampionClick = (champ: ChampionEntry) => {
    setSelected(champ);
    setAscension(0);
  };

  const handleConfirm = () => {
    if (!selected) return;
    if (currentPlacement?.attacker_champion_user_id) {
      setShowReplaceConfirm(true);
      return;
    }
    doSelect();
  };

  const doSelect = () => {
    if (!selected) return;
    onSelect(selected.id, selected.name, selectedRarity.stars, selectedRarity.rank, ascension);
    onClose();
  };

  return (
    <>
    <ConfirmationDialog
      open={showReplaceConfirm}
      onOpenChange={(v) => setShowReplaceConfirm(v)}
      title={t.game.war.replaceDefenderWithAttackerTitle}
      description={t.game.war.replaceDefenderWithAttackerDesc}
      variant='destructive'
      onConfirm={doSelect}
      data-cy='war-replace-defender-confirm'
    >
      {selected && (
        <div className='flex flex-col gap-3 mt-2'>
          <div className='flex items-center gap-3 px-2'>
            <ChampionPortrait
              imageUrl={selected.image_url}
              name={selected.name}
              rarity={`${selectedRarity.stars}r${selectedRarity.rank}`}
              size={48}
            />
            <div>
              <div className='text-sm font-semibold'>{selected.name}</div>
              <div className='text-xs text-muted-foreground'>
                {selectedRarity.stars}★R{selectedRarity.rank}
                {ascension > 0 && <span className='text-purple-400'> · A{ascension}</span>}
              </div>
            </div>
          </div>
          {currentPlacement && (
            <>
              <Separator />
              <div className='flex justify-center'>
                <AttackerEntryRow
                  placement={currentPlacement}
                  mode='full'
                  readonly
                />
              </div>
            </>
          )}
        </div>
      )}
    </ConfirmationDialog>
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
      <div className='bg-card border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col'>
        <div className='p-4 border-b flex items-center justify-between'>
          <h2 className='font-semibold'>
            {t.game.defense.selectChampion} —{' '}
            {t.game.defense.nodeEmpty.replace('{node}', String(nodeNumber))}
          </h2>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        {currentPlacement && (
          <>
            <div className='px-6 py-2'>
              <AttackerEntryRow
                placement={currentPlacement}
                mode='full'
              />
            </div>
            <Separator />
          </>
        )}

        {!selected ? (
          <>
            <div className='p-3 border-b'>
              <SearchInput
                ref={searchInputRef}
                value={search}
                onChange={setSearch}
                placeholder={t.game.war.searchChampion}
                data-cy='war-champion-search'
              />
            </div>
            <div className='overflow-y-auto flex-1 p-3'>
              {loading && champions.length === 0 ? (
                <div className='text-center text-muted-foreground py-8'>
                  {t.game.war.loadingChampions}
                </div>
              ) : (
                <>
                  <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
                    {champions
                      .filter((c) => !placedChampionIds.has(c.id))
                      .map((champ) => {
                        const classColors = getClassColors(champ.champion_class);
                        return (
                          <button
                            key={champ.id}
                            className={cn(
                              'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                              'hover:ring-2 hover:ring-primary/60 hover:border-primary/60'
                            )}
                            onClick={() => handleChampionClick(champ)}
                            data-cy={`war-champion-card-${champ.name.replaceAll(/\s+/g, '-')}`}
                          >
                            <ChampionPortrait
                              imageUrl={champ.image_url}
                              name={champ.name}
                              rarity='7r3'
                              size={48}
                            />
                            <span className='text-[10px] text-center truncate w-full leading-tight'>
                              {shortenChampionName(champ.name)}
                            </span>
                            <span className={cn('text-[9px] font-medium', classColors.label)}>
                              {champ.champion_class}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {page < totalPages && (
                    <div className='text-center mt-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => fetchChampions(search, page + 1)}
                        disabled={loading}
                      >
                        {t.game.war.loadMore}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className='flex-1 overflow-y-auto p-4 flex flex-col gap-4'>
            <div className='flex items-center gap-3'>
              <ChampionPortrait
                imageUrl={selected.image_url}
                name={selected.name}
                rarity={`${selectedRarity.stars}r${selectedRarity.rank}`}
                size={56}
              />
              <div>
                <div className='font-semibold'>{selected.name}</div>
                <div className='text-sm text-muted-foreground'>{selected.champion_class}</div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='ml-auto'
                onClick={() => setSelected(null)}
              >
                {t.game.war.changeChampion}
              </Button>
            </div>

            {/* Rarity selector */}
            <div>
              <div className='text-sm font-medium mb-2'>{t.game.war.rarity}</div>
              <div className='flex flex-wrap gap-2'>
                {WAR_RARITIES.map((r) => (
                  <button
                    key={r.label}
                    className={cn(
                      'px-3 py-1 rounded border text-sm font-medium transition-colors',
                      selectedRarity.stars === r.stars && selectedRarity.rank === r.rank
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted hover:bg-accent border-border'
                    )}
                    onClick={() => setSelectedRarity({ stars: r.stars, rank: r.rank })}
                    data-cy={`rarity-${r.label.replace('★', 's')}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ascension selector */}
            {selected.is_ascendable && (
              <div>
                <div className='text-sm font-medium mb-2'>{t.game.war.ascension}</div>
                <div className='flex gap-2'>
                  {[0, 1, 2].map((a) => (
                    <button
                      key={a}
                      className={cn(
                        'px-3 py-1 rounded border text-sm font-medium transition-colors',
                        ascension === a
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-muted hover:bg-accent border-border'
                      )}
                      onClick={() => setAscension(a)}
                    >
                      {a === 0 ? t.game.war.ascensionNone : `A${a}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className='mt-auto pt-4 border-t flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={onClose}
              >
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleConfirm}
                data-cy='war-confirm-place'
              >
                {t.game.war.placeOnNode.replace('{node}', String(nodeNumber))}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
