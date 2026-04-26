'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import {
  type AvailableChampion,
  type ChampionOwner,
  type DefensePlacement,
} from '@/app/services/defense';
import { RARITY_LABELS, getClassColors, shortenChampionName } from '@/app/services/roster';
import { Separator } from '@/components/ui/separator';
import SelectorFilterBar from '@/app/game/_components/selector-filter-bar';

interface AllianceDefenseSelectorProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  availableChampions: AvailableChampion[];
  onSelect: (championUserId: string, gameAccountId: string, championName: string) => void;
  currentPlacement?: DefensePlacement;
}

export default function AllianceDefenseSelector({
  open,
  onClose,
  nodeNumber,
  availableChampions,
  onSelect,
  currentPlacement,
}: Readonly<AllianceDefenseSelectorProps>) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [sagaFilter, setSagaFilter] = useState(false);
  const [notPreferredFilter, setNotPreferredFilter] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState<AvailableChampion | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableClasses = useMemo(() => {
    const classes = new Set(availableChampions.map((c) => c.champion_class));
    return Array.from(classes).sort();
  }, [availableChampions]);

  const availablePlayers = useMemo(() => {
    const players = new Set(
      availableChampions.flatMap((champ) => champ.owners.map((owner) => owner.game_pseudo))
    );
    return Array.from(players).sort();
  }, [availableChampions]);

  const canReset =
    search !== '' || classFilter !== '' || playerFilter !== '' || sagaFilter || notPreferredFilter;

  const filtered = useMemo(() => {
    return availableChampions
      .map((champ) => {
        const owners = champ.owners.filter((owner) => {
          const matchPlayer =
            !playerFilter || owner.game_pseudo.toLowerCase().includes(playerFilter.toLowerCase());
          const matchNotPreferred = !notPreferredFilter || !owner.is_preferred_attacker;
          return matchPlayer && matchNotPreferred;
        });
        return { ...champ, owners };
      })
      .filter((champ) => {
        if (champ.owners.length === 0) return false;
        const query = search.toLowerCase();
        const matchSearch =
          !search.trim() ||
          champ.champion_name.toLowerCase().includes(query) ||
          champ.champion_class.toLowerCase().includes(query) ||
          (champ.champion_alias ?? '').toLowerCase().includes(query);
        const matchClass = !classFilter || champ.champion_class === classFilter;
        const matchSaga = !sagaFilter || champ.is_saga_defender;
        return matchSearch && matchClass && matchSaga;
      });
  }, [search, classFilter, playerFilter, sagaFilter, notPreferredFilter, availableChampions]);

  // Defer rendering of the grid by one frame so the dialog open animation is smooth
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    setReady(false);
  }, [open]);

  const handleSelectChampion = (champ: AvailableChampion) => {
    if (champ.owners.length === 1) {
      const owner = champ.owners[0];
      onSelect(owner.champion_user_id, owner.game_account_id, champ.champion_name);
      handleClose();
    } else {
      setSelectedChampion(champ);
    }
  };

  const handleSelectOwner = (owner: ChampionOwner, championName: string) => {
    onSelect(owner.champion_user_id, owner.game_account_id, championName);
    handleClose();
  };

  const handleClose = () => {
    setSearch('');
    setClassFilter('');
    setPlayerFilter('');
    setSagaFilter(false);
    setNotPreferredFilter(false);
    setSelectedChampion(null);
    onClose();
  };

  const handleReset = () => {
    setSearch('');
    setClassFilter('');
    setPlayerFilter('');
    setSagaFilter(false);
    setNotPreferredFilter(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[80vh] overflow-hidden flex flex-col'
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {selectedChampion
              ? `${t.game.defense.selectPlayer} — ${shortenChampionName(selectedChampion.champion_name)}`
              : `${t.game.defense.selectChampion} — Node #${nodeNumber}`}
          </DialogTitle>
        </DialogHeader>

        <Separator />
        <div
          className='px-6 py-3 flex items-center gap-3'
          data-cy='defense-current-placement'
        >
          {currentPlacement ? (
            <>
              <ChampionPortrait
                imageUrl={currentPlacement.champion_image_url}
                name={currentPlacement.champion_name}
                rarity={currentPlacement.rarity}
                size={44}
                ascension={currentPlacement.ascension}
                is_saga_attacker={currentPlacement.is_saga_attacker}
                is_saga_defender={currentPlacement.is_saga_defender}
                sagaMode='defender'
              />
              <div className='min-w-0'>
                <div className='text-sm font-medium truncate'>{currentPlacement.champion_name}</div>
                <div className='text-xs text-muted-foreground'>
                  {currentPlacement.game_pseudo} · #{currentPlacement.node_number}
                </div>
              </div>
            </>
          ) : (
            <div className='text-sm text-muted-foreground'>
              {t.game.defense.nodeEmpty.replace('{node}', String(nodeNumber))}
            </div>
          )}
        </div>
        <Separator />

        {!selectedChampion ? (
          <>
            <SearchInput
              ref={searchInputRef}
              placeholder={t.roster.searchChampion}
              value={search}
              onChange={(val) => setSearch(val)}
              className='mb-2'
            />
            <SelectorFilterBar
              classes={availableClasses}
              classFilter={classFilter}
              onClassChange={setClassFilter}
              players={availablePlayers}
              playerFilter={playerFilter}
              onPlayerChange={setPlayerFilter}
              toggles={[
                {
                  key: 'saga',
                  label: t.game.defense.sagaDefenderFilter,
                  active: sagaFilter,
                  onToggle: setSagaFilter,
                },
                {
                  key: 'notPreferred',
                  label: t.game.defense.notPreferredFilter,
                  active: notPreferredFilter,
                  onToggle: setNotPreferredFilter,
                },
              ]}
              canReset={canReset}
              onReset={handleReset}
            />
            <div className='overflow-y-auto flex-1 pr-1 mt-3'>
              {!ready ? (
                <p className='text-muted-foreground text-sm text-center py-8'>{t.common.loading}</p>
              ) : filtered.length === 0 ? (
                <p className='text-muted-foreground text-sm text-center py-8'>
                  {t.game.defense.noChampionsAvailable}
                </p>
              ) : (
                <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
                  {filtered.map((champ) => {
                    const classColors = getClassColors(champ.champion_class);
                    const bestOwner = champ.owners[0];
                    return (
                      <button
                        key={champ.champion_id}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                          'hover:ring-2 hover:ring-white/40 cursor-pointer',
                          'bg-card border-border'
                        )}
                        onClick={() => handleSelectChampion(champ)}
                        title={`${champ.champion_name} — ${champ.owners.length} owner(s)`}
                        data-cy={`champion-card-${champ.champion_name.replaceAll(/\s+/g, '-')}`}
                      >
                        <ChampionPortrait
                          imageUrl={champ.image_url}
                          name={champ.champion_name}
                          rarity={bestOwner.rarity}
                          size={48}
                          isPreferred={champ.owners.every((o) => o.is_preferred_attacker)}
                          ascension={bestOwner.ascension}
                          is_saga_attacker={champ.is_saga_attacker}
                          is_saga_defender={champ.is_saga_defender}
                          sagaMode='defender'
                        />
                        <span className='text-[10px] text-center truncate w-full leading-tight'>
                          {shortenChampionName(champ.champion_name)}
                        </span>
                        <span className={cn('text-[9px] font-medium', classColors.label)}>
                          {RARITY_LABELS[bestOwner.rarity] ?? bestOwner.rarity}
                          {bestOwner.ascension > 0 && (
                            <span className='text-purple-400 font-semibold'>
                              {' '}
                              · A{bestOwner.ascension}
                            </span>
                          )}
                        </span>
                        {champ.owners.length === 1 ? (
                          <span className='text-[9px] text-muted-foreground truncate w-full text-center'>
                            {bestOwner.game_pseudo} · {bestOwner.defender_count}/5
                          </span>
                        ) : (
                          <span className='text-[9px] text-muted-foreground'>
                            {t.game.defense.ownersCount.replace(
                              '{count}',
                              String(champ.owners.length)
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className='overflow-y-auto flex-1'>
            <Button
              variant='ghost'
              size='sm'
              className='mb-3'
              onClick={() => setSelectedChampion(null)}
            >
              ← {t.common.back}
            </Button>
            <div className='space-y-2'>
              {selectedChampion.owners.map((owner) => (
                <button
                  key={owner.champion_user_id}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                    'hover:ring-2 hover:ring-white/40 cursor-pointer',
                    'bg-card border-border',
                    owner.defender_count >= 5 && 'opacity-40 pointer-events-none'
                  )}
                  onClick={() => handleSelectOwner(owner, selectedChampion.champion_name)}
                  disabled={owner.defender_count >= 5}
                  data-cy={`owner-row-${owner.game_pseudo}`}
                >
                  <ChampionPortrait
                    imageUrl={selectedChampion.image_url}
                    name={selectedChampion.champion_name}
                    rarity={owner.rarity}
                    size={44}
                    isPreferred={owner.is_preferred_attacker}
                    ascension={owner.ascension}
                    is_saga_attacker={selectedChampion.is_saga_attacker}
                    is_saga_defender={selectedChampion.is_saga_defender}
                    sagaMode='defender'
                  />
                  <div className='flex flex-col items-start'>
                    <span className='font-medium text-sm'>{owner.game_pseudo}</span>
                    <span className='text-xs text-muted-foreground'>
                      {RARITY_LABELS[owner.rarity] ?? owner.rarity}
                      {owner.ascension > 0 && (
                        <span className='text-purple-400 font-semibold'> · A{owner.ascension}</span>
                      )}
                      {' · '}
                      sig {owner.signature}
                    </span>
                    <span className='text-[10px] text-muted-foreground'>
                      {t.game.defense.defendersPlaced}: {owner.defender_count}/5
                    </span>
                  </div>
                  {owner.stars === 7 && (
                    <span className='ml-auto text-xs font-bold text-yellow-400'>7</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
