'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChampionPortrait from '@/components/champion-portrait';
import { Separator } from '@/components/ui/separator';
import { type AvailableAttacker, getAvailableAttackers } from '@/app/services/war';
import { useWar } from '../_context/war-context';

interface PrefightSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  targetNodeNumber: number;
  targetGameAccountId: string;
}

export default function PrefightSelectorDialog({
  open,
  onClose,
  targetNodeNumber,
  targetGameAccountId,
}: Readonly<PrefightSelectorDialogProps>) {
  const { t } = useI18n();
  const { selectedAllianceId, activeWarId, selectedBg, handleAddPrefight, prefights } = useWar();
  const [attackers, setAttackers] = useState<AvailableAttacker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !selectedAllianceId || !activeWarId) return;
    setLoading(true);
    getAvailableAttackers(selectedAllianceId, activeWarId, selectedBg)
      .then(setAttackers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, selectedAllianceId, activeWarId, selectedBg]);

  const usedPrefightIds = new Set(prefights.map((p) => p.champion_user_id));
  const available = attackers.filter((a) => !usedPrefightIds.has(a.champion_user_id));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className='max-w-md max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='prefight-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.prefight.add} — {t.game.war.prefight.for.replace('#{node}', String(targetNodeNumber))}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <div className='overflow-y-auto p-4'>
          {loading ? (
            <p className='text-sm text-muted-foreground'>{t.game.war.availableAttackersError}</p>
          ) : available.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t.game.war.prefight.noneAvailable}</p>
          ) : (
            <div className='grid grid-cols-3 gap-2'>
              {available.map((a) => (
                <button
                  key={a.champion_user_id}
                  className='flex flex-col items-center gap-1 p-2 rounded-lg border hover:ring-2 hover:ring-primary/60 transition-all'
                  data-cy={`prefight-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
                  onClick={async () => {
                    onClose();
                    await handleAddPrefight(a.champion_user_id, targetNodeNumber);
                  }}
                >
                  <ChampionPortrait imageUrl={a.image_url} name={a.champion_name} rarity={a.rarity} size={52} />
                  <span className='text-[10px] text-center leading-tight truncate w-full'>{a.champion_name}</span>
                  <span className='text-[9px] text-muted-foreground truncate w-full text-center'>{a.game_pseudo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
