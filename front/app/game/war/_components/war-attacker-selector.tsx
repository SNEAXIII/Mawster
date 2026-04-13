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
import {
  type AvailableAttacker,
  type WarPlacement,
  getAvailableAttackers,
} from '@/app/services/war';
import AttackerEntryRow from './attacker-entry-row';

interface WarAttackerSelectorProps {
  open: boolean;
  onClose: () => void;
  nodeNumber: number;
  allianceId: string;
  warId: string;
  battlegroup: number;
  placements: WarPlacement[];
  onSelect: (attacker: AvailableAttacker) => void;
}

interface GroupedAttackers {
  pseudo: string;
  gameAccountId: string;
  attackers: AvailableAttacker[];
  assignedCount: number;
}

export default function WarAttackerSelector({
  open,
  onClose,
  nodeNumber,
  allianceId,
  warId,
  battlegroup,
  placements,
  onSelect,
}: Readonly<WarAttackerSelectorProps>) {
  const { t } = useI18n();
  const [available, setAvailable] = useState<AvailableAttacker[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [championSearch, setChampionSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchAvailable = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getAvailableAttackers(allianceId, warId, battlegroup, undefined, nodeNumber);
      setAvailable(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [allianceId, warId, battlegroup, nodeNumber]);

  useEffect(() => {
    if (open) {
      fetchAvailable();
      setPlayerSearch('');
      setChampionSearch('');
    }
  }, [open, fetchAvailable]);

  // Count already-assigned attackers per pseudo from current placements
  const assignedByPseudo = new Map<string, number>();
  for (const p of placements) {
    if (p.attacker_pseudo) {
      assignedByPseudo.set(p.attacker_pseudo, (assignedByPseudo.get(p.attacker_pseudo) ?? 0) + 1);
    }
  }

  const filtered = available.filter((a) => {
    const matchPlayer =
      !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase());
    const alias = (a.champion_alias ?? '').toLowerCase();
    const matchChampion =
      !championSearch
      || a.champion_name.toLowerCase().includes(championSearch.toLowerCase())
      || alias.includes(championSearch.toLowerCase());
    return matchPlayer && matchChampion;
  });

  // Group by member
  const groupMap = new Map<string, GroupedAttackers>();
  for (const a of filtered) {
    let group = groupMap.get(a.game_account_id);
    if (!group) {
      group = {
        pseudo: a.game_pseudo,
        gameAccountId: a.game_account_id,
        attackers: [],
        assignedCount: assignedByPseudo.get(a.game_pseudo) ?? 0,
      };
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
      <div className='text-center text-muted-foreground py-8'>{t.game.war.noAvailableAttackers}</div>
    );
  } else {
    content = groups.map((group) => (
      <div key={group.gameAccountId}>
        <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1'>
          {group.pseudo}{' '}
          <span className='text-primary font-bold'>
            {t.game.war.memberAttackers.replace('{count}', String(group.assignedCount))}
          </span>
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
                  onSelect(a);
                  onClose();
                }}
                data-cy={`attacker-card-${a.champion_name.replaceAll(/\s+/g, '-')}`}
              >
                <ChampionPortrait
                  imageUrl={a.image_url}
                  name={a.champion_name}
                  rarity={a.rarity}
                  size={48}
                  isPreferred={a.is_preferred_attacker}
                  ascension={a.ascension}
                  isSaga={a.is_saga_attacker || a.is_saga_defender}
                />
                <span className='text-[10px] text-center truncate w-full leading-tight'>
                  {shortenChampionName(a.champion_name)}
                </span>
                <span className={cn('text-[9px] font-mono leading-none', rarityBadgeClass(a.rarity))}>
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

  const currentPlacement = placements.find((p) => p.node_number === nodeNumber);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='war-attacker-search'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.selectAttacker.replace('{node}', String(nodeNumber))}
          </DialogTitle>
        </DialogHeader>
        {currentPlacement ? (
          <>
            <Separator />
            <div className='px-3'>
              <AttackerEntryRow
                placement={currentPlacement}
                mode='full'
              />
            </div>
          </>
        ) : null}
        <Separator />
        <div className='px-4 py-3 flex gap-2'>
          <SearchInput
            value={playerSearch}
            onChange={setPlayerSearch}
            placeholder={t.game.war.searchPlayer}
            data-cy='war-attacker-search-player'
          />
          <SearchInput
            value={championSearch}
            onChange={setChampionSearch}
            placeholder={t.game.war.searchChampion}
            data-cy='war-attacker-search-champion'
          />
        </div>
        <Separator />
        <div className='overflow-y-auto flex-1 p-3 space-y-4'>{content}</div>
      </DialogContent>
    </Dialog>
  );
}
