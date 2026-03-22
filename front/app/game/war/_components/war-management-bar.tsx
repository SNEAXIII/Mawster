'use client';

import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import type { War } from '@/app/services/war';

interface WarManagementBarProps {
  activeWar: War | null;
  loading: boolean;
  onClickDeclare: () => void;
  onClickEndWar: () => void;
}

export default function WarManagementBar({
  activeWar,
  loading,
  onClickDeclare,
  onClickEndWar,
}: WarManagementBarProps) {
  const { t } = useI18n();

  if (loading) {
    return <div className='h-9 w-48 bg-muted animate-pulse rounded' />;
  }

  if (!activeWar) {
    return (
      <div className='flex items-center gap-3'>
        <p className='text-muted-foreground text-sm'>{t.game.war.noWar}</p>
        <Button
          onClick={onClickDeclare}
          data-cy='declare-war-btn'
        >
          {t.game.war.declareWar}
        </Button>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-3'>
      <div className='flex items-center gap-2'>
        <Swords className='w-4 h-4 text-muted-foreground' />
        <span
          className='text-sm font-semibold'
          data-cy='war-opponent-name'
        >
          vs {activeWar.opponent_name}
        </span>
      </div>
      <Button
        variant='destructive'
        onClick={onClickEndWar}
        data-cy='end-war-btn'
      >
        {t.game.war.endWar}
      </Button>
    </div>
  );
}
