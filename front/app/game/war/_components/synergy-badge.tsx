'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';

interface SynergyBadgeProps {
  targetChampionName: string;
  className?: string;
}

export default function SynergyBadge({ targetChampionName, className }: Readonly<SynergyBadgeProps>) {
  const { t } = useI18n();

  return (
    <div
      title={t.game.war.synergy.for.replace('{champion}', targetChampionName)}
      className={cn(
        'absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-0.5',
        'flex items-center justify-center',
        className
      )}
    >
      <Zap className='w-2.5 h-2.5' />
    </div>
  );
}
