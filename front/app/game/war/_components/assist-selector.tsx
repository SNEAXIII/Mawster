'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SearchInput } from '@/components/search-input';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { getClassColors, shortenChampionName } from '@/app/services/roster';
import { rarityBadgeClass, rarityLabel } from '@/app/game/defense/_components/defense-utils';
import { type AvailableAttacker, getAvailableAttackers } from '@/app/services/war';
import { useWar } from '@/app/contexts/war-context';

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
  const [available, setAvailable] = useState<AvailableAttacker[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [championSearch, setChampionSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchAvailable = useCallback(async () => {
    if (!selectedAllianceId || !activeWarId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getAvailableAttackers(selectedAllianceId, activeWarId, selectedBg);
      setAvailable(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedAllianceId, activeWarId, selectedBg]);

  useEffect(() => {
    if (open) {
      fetchAvailable();
      setPlayerSearch('');
      setChampionSearch('');
    }
  }, [open, fetchAvailable]);

  const filtered = available
    .filter((a) => attackerGameAccountId === null || a.game_account_id !== attackerGameAccountId)
    .filter((a) => {
      const matchPlayer =
        !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase());
      const alias = (a.champion_alias ?? '').toLowerCase();
      const matchChampion =
        !championSearch ||
        a.champion_name.toLowerCase().includes(championSearch.toLowerCase()) ||
        alias.includes(championSearch.toLowerCase());
      return matchPlayer && matchChampion;
    });

  const groupMap = new Map<
    string,
    { pseudo: string; gameAccountId: string; attackers: AvailableAttacker[] }
  >();
  for (const a of filtered) {
    let group = groupMap.get(a.game_account_id);
    if (!group) {
      group = { pseudo: a.game_pseudo, gameAccountId: a.game_account_id, attackers: [] };
      groupMap.set(a.game_account_id, group);
    }
    group.attackers.push(a);
  }
  const groups = Array.from(groupMap.values());

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
        <div className='overflow-y-auto flex-1 p-3 space-y-4'>{content}</div>
      </DialogContent>
    </Dialog>
  );
}
