'use client';

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { type AvailableChampion, type ChampionOwner } from '@/app/services/defense';
import { RARITY_LABELS, getClassColors, shortenChampionName } from '@/app/services/roster';

interface ChampionSelectorProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  availableChampions: AvailableChampion[];
  onSelect: (
    championUserId: string,
    gameAccountId: string,
    championName: string,
  ) => void;
}

export default function ChampionSelector({
  open,
  onClose,
  nodeNumber,
  availableChampions,
  onSelect,
}: ChampionSelectorProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedChampion, setSelectedChampion] = useState<AvailableChampion | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return availableChampions;
    const q = search.toLowerCase();
    return availableChampions.filter(
      (c) =>
        c.champion_name.toLowerCase().includes(q) ||
        c.champion_class.toLowerCase().includes(q),
    );
  }, [search, availableChampions]);

  const handleSelectChampion = (champ: AvailableChampion) => {
    if (champ.owners.length === 1) {
      // Only one owner → place directly
      const owner = champ.owners[0];
      onSelect(owner.champion_user_id, owner.game_account_id, champ.champion_name);
      handleClose();
    } else {
      // Multiple owners → show owner picker
      setSelectedChampion(champ);
    }
  };

  const handleSelectOwner = (owner: ChampionOwner, championName: string) => {
    onSelect(owner.champion_user_id, owner.game_account_id, championName);
    handleClose();
  };

  const handleClose = () => {
    setSearch('');
    setSelectedChampion(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {selectedChampion
              ? `${t.game.defense.selectPlayer} — ${shortenChampionName(selectedChampion.champion_name)}`
              : `${t.game.defense.selectChampion} — Node #${nodeNumber}`}
          </DialogTitle>
        </DialogHeader>

        {!selectedChampion ? (
          <>
            <SearchInput
              placeholder={t.roster.searchChampion}
              value={search}
              onChange={setSearch}
              className="mb-3"
            />
            <div className="overflow-y-auto flex-1 pr-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {t.game.defense.noChampionsAvailable}
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {filtered.map((champ) => {
                    const classColors = getClassColors(champ.champion_class);
                    const bestOwner = champ.owners[0]; // already sorted by stars desc
                    return (
                      <button
                        key={champ.champion_id}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                          'hover:ring-2 hover:ring-white/40 cursor-pointer',
                          'bg-card border-border',
                        )}
                        onClick={() => handleSelectChampion(champ)}
                        title={`${champ.champion_name} — ${champ.owners.length} owner(s)`}
                      >
                        <ChampionPortrait
                          imageUrl={champ.image_url}
                          name={champ.champion_name}
                          rarity={bestOwner.rarity}
                          size={48}
                        />
                        <span className="text-[10px] text-center truncate w-full leading-tight">
                          {shortenChampionName(champ.champion_name)}
                        </span>
                        <span className={cn('text-[9px] font-medium', classColors.label)}>
                          {RARITY_LABELS[bestOwner.rarity] ?? bestOwner.rarity}
                        </span>
                        {bestOwner.is_preferred_attacker && (
                          <span
                            className="text-[10px] text-amber-400 font-bold"
                            title={t.game.defense.preferredAttackerWarning}
                          >
                            ⚔
                          </span>
                        )}
                        {champ.owners.length === 1 ? (
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                            {bestOwner.game_pseudo} · {bestOwner.defender_count}/5
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground">
                            {t.game.defense.ownersCount.replace('{count}', String(champ.owners.length))}
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
          /* Owner picker */
          <div className="overflow-y-auto flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="mb-3"
              onClick={() => setSelectedChampion(null)}
            >
              ← {t.common.back}
            </Button>
            <div className="space-y-2">
              {selectedChampion.owners.map((owner) => (
                <button
                  key={owner.champion_user_id}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                    'hover:ring-2 hover:ring-white/40 cursor-pointer',
                    'bg-card border-border',
                    owner.defender_count >= 5 && 'opacity-40 pointer-events-none',
                  )}
                  onClick={() => handleSelectOwner(owner, selectedChampion.champion_name)}
                  disabled={owner.defender_count >= 5}
                >
                  <ChampionPortrait
                    imageUrl={selectedChampion.image_url}
                    name={selectedChampion.champion_name}
                    rarity={owner.rarity}
                    size={44}
                  />
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">
                      {owner.is_preferred_attacker && <span className="text-yellow-400">⚔ </span>}
                      {owner.game_pseudo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {RARITY_LABELS[owner.rarity] ?? owner.rarity}
                      {' · '}
                      sig {owner.signature}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t.game.defense.defendersPlaced}: {owner.defender_count}/5
                    </span>
                  </div>
                  {owner.stars === 7 && (
                    <span className="ml-auto text-xs font-bold text-yellow-400">7★</span>
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
