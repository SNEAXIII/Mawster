'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChampionPortrait from '@/components/champion-portrait';
import { Separator } from '@/components/ui/separator';
import { type AvailableAttacker, getAvailableAttackers } from '@/app/services/war';
import { useWar } from '../_context/war-context';

interface SynergySelectorDialogProps {
  open: boolean;
  onClose: () => void;
  targetChampionUserId: string;
  targetChampionName: string;
}

export default function SynergySelectorDialog({
  open,
  onClose,
  targetChampionUserId,
  targetChampionName,
}: Readonly<SynergySelectorDialogProps>) {
  const { t } = useI18n();
  const { selectedAllianceId, activeWarId, selectedBg, handleAddSynergy, synergies, isMine } = useWar();
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

  const usedSynergyIds = new Set(synergies.map((s) => s.champion_user_id));
  const available = attackers.filter(
    (a) => isMine(a.game_account_id) && !usedSynergyIds.has(a.champion_user_id)
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className='max-w-md max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0'
        data-cy='synergy-selector'
      >
        <DialogHeader className='px-6 py-4'>
          <DialogTitle>
            {t.game.war.synergy.add} — {targetChampionName}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <div className='overflow-y-auto p-4'>
          {loading ? (
            <p className='text-sm text-muted-foreground'>{t.game.war.availableAttackersError}</p>
          ) : available.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t.game.war.noAvailableAttackers}</p>
          ) : (
            <div className='grid grid-cols-3 gap-2'>
              {available.map((a) => (
                <button
                  key={a.champion_user_id}
                  className='flex flex-col items-center gap-1 p-2 rounded-lg border hover:ring-2 hover:ring-primary/60 transition-all'
                  data-cy={`synergy-pick-${a.champion_name.replaceAll(/\s+/g, '-')}`}
                  onClick={async () => {
                    onClose();
                    await handleAddSynergy(a.champion_user_id, targetChampionUserId);
                  }}
                >
                  <ChampionPortrait
                    imageUrl={a.image_url}
                    name={a.champion_name}
                    rarity={a.rarity}
                    size={48}
                  />
                  <span className='text-[10px] text-center truncate w-full leading-tight'>
                    {a.champion_name}
                  </span>
                  <span className='text-[9px] font-mono text-muted-foreground'>{a.rarity}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
