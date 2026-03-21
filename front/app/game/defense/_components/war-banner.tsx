'use client';

import { Button } from '@/components/ui/button';
import { Swords, Flag } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { War } from '@/app/services/war';

interface WarBannerProps {
  currentWar: War | null;
  warLoading: boolean;
  onOpenCreateDialog: () => void;
  onOpenEndConfirm: () => void;
}

export default function WarBanner({
  currentWar,
  warLoading,
  onOpenCreateDialog,
  onOpenEndConfirm,
}: Readonly<WarBannerProps>) {
  const { t } = useI18n();

  if (warLoading) return null;

  return (
    <div className='flex items-center gap-3' data-cy='war-banner'>
      {currentWar ? (
        <>
          <div className='flex items-center gap-1.5 text-sm'>
            <Swords className='w-4 h-4 text-muted-foreground' />
            <span className='text-muted-foreground'>vs</span>
            <span className='font-semibold' data-cy='current-war-opponent'>
              {currentWar.opponent_name}
            </span>
          </div>
          <Button
            variant='destructive'
            size='sm'
            onClick={onOpenEndConfirm}
            data-cy='end-war-btn'
          >
            <Flag className='w-4 h-4 mr-1' />
            {t.game.war.endWar}
          </Button>
        </>
      ) : (
        <>
          <span className='text-sm text-muted-foreground'>{t.game.war.noActiveWar}</span>
          <Button
            variant='default'
            size='sm'
            onClick={onOpenCreateDialog}
            data-cy='declare-war-btn'
          >
            <Swords className='w-4 h-4 mr-1' />
            {t.game.war.declareWar}
          </Button>
        </>
      )}
    </div>
  );
}
