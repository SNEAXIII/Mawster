'use client';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';

interface WarManagementBarProps {
  loading: boolean;
  onClickDeclare: () => void;
}

export default function WarManagementBar({
  loading,
  onClickDeclare,
}: Readonly<WarManagementBarProps>) {
  const { t } = useI18n();

  if (loading) {
    return <div className='h-9 w-48 bg-muted animate-pulse rounded' />;
  }

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
