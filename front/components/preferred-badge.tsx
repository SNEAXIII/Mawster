'use client';

import { cn } from '@/app/lib/utils';
import { Crown } from 'lucide-react';

export default function PreferredBadge({
  additionalClasses = '',
}: Readonly<{ additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute top-0 left-0 bg-white text-black rounded-full p-0.5 flex items-center justify-center',
        additionalClasses
      )}
      data-cy='preferred-badge'
    >
      <Crown className='w-2.5 h-2.5' />
    </div>
  );
}
