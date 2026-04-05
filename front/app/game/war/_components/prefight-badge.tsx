'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useI18n } from '@/app/i18n';

interface PrefightBadgeProps {
  nodeNumber: number;
  className?: string;
}

export default function PrefightBadge({ nodeNumber, className }: Readonly<PrefightBadgeProps>) {
  const { t } = useI18n();

  return (
    <div
      title={t.game.war.prefight.for.replace('{node}', String(nodeNumber))}
      className={cn(
        'absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-0.5',
        'flex items-center justify-center',
        className
      )}
    >
      <Flame className='w-2.5 h-2.5' />
    </div>
  );
}
