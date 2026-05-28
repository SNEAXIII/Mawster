'use client';

import { useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { getClassColors, shortenChampionName } from '@/app/services/roster';
import { rarityBadgeClass, rarityLabel } from '@/app/game/defense/_components/defense-utils';
import { getAvailableAttackers } from '@/app/services/war';
import { useWar } from '@/app/contexts/war-context';
import { useAvailableAttackers } from './use-available-attackers';

interface AssistSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  attackerGameAccountId: string | null;
}

export default function AssistSelectorDialog({
  open,
  onClose,
  nodeNumber,
  attackerGameAccountId,
}: Readonly<AssistSelectorDialogProps>) {
  const { t } = useI18n();
  const { selectedAllianceId, activeWarId, selectedBg, handleAssignAssist } = useWar();

  const fetchFn = useCallback(
    () => getAvailableAttackers(selectedAllianceId!, activeWarId!, selectedBg),
    [selectedAllianceId, activeWarId, selectedBg]
  );
  const guardedFetch = selectedAllianceId && activeWarId ? fetchFn : null;

  const {
    available,
    playerSearch,
    setPlayerSearch,
    championSearch,
    setChampionSearch,
    loading,
    error,
    filterBySearch,
    buildGroups,
  } = useAvailableAttackers(open, guardedFetch);

  const filtered = filterBySearch(
    available.filter(
      (a) => attackerGameAccountId === null || a.game_account_id !== attackerGameAccountId
    )
  );
  const groups = buildGroups(filtered);

  let content: React.ReactNode;
  if (loading) {
    content = <div className='text-center text-muted-foreground py-8'>{t.common.loading}</div>;
  } else if (error) {
    content = (
      <div className='text-center text-destructive py-8'>{t.game.war.availableAttackersError}</div>
    );
  } else if (groups.length === 0) {
    content = (
      <div className='text-center text-muted-foreground py-8'>
        {t.game.war.assist.noneAvailable}
      </div>
    );
  } else {
    content = groups.map((group) => (
      <div key={group.gameAccountId}>
        <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1'>
          {group.pseudo}
        </div>
        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
          {group.attackers.map((a) => {
            const classColors = getClassColors(a.champion_class);
            return (
              <button
                key={a.champion_user_id}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                  'hover:ring-2 hover:ring-primary/60'
                )}
                onClick={() => {
                  void handleAssignAssist(nodeNumber, a.champion_user_id);
                  onClose();
                }}
                data-cy={`assist-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
              >
                <ChampionPortrait
                  imageUrl={a.image_url}
                  name={a.champion_name}
                  rarity={a.rarity}
                  size={48}
                  isPreferred={a.is_preferred_attacker}
                  ascension={a.ascension}
                  is_saga_attacker={a.is_saga_attacker}
                  is_saga_defender={a.is_saga_defender}
                  sagaMode='attacker'
                />
                <span className='text-[10px] text-center truncate w-full leading-tight'>
                  {shortenChampionName(a.champion_name)}
                </span>
                <span
                  className={cn('text-[9px] font-mono leading-none', rarityBadgeClass(a.rarity))}
                >
                  {rarityLabel(a.rarity, a.signature, a.ascension)}
                </span>
                <span className={cn('text-[9px] font-medium', classColors.label)}>
                  {a.champion_class}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='assist-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.assist.add} — #{nodeNumber}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <div className='px-4 py-3 flex gap-2'>
          <SearchInput
            value={playerSearch}
            onChange={setPlayerSearch}
            placeholder={t.game.war.searchPlayer}
            data-cy='assist-search-player'
          />
          <SearchInput
            value={championSearch}
            onChange={setChampionSearch}
            placeholder={t.game.war.searchChampion}
            data-cy='assist-search-champion'
          />
        </div>
        <Separator />
        <div className='overflow-y-auto flex-1 p-3 flex flex-col gap-4'>{content}</div>
      </DialogContent>
    </Dialog>
  );
}
