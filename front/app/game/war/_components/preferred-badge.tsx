'use client';

import { cn } from '@/app/lib/utils';
import { Swords } from 'lucide-react';

export default function PreferredBadge({ additionalClasses = '' }: Readonly<{ additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute top-0 left-0 bg-yellow-500 text-white rounded-full p-0.5 flex items-center justify-center',
        additionalClasses
      )}
      data-cy='preferred-badge'
    >
      <Swords className='w-2.5 h-2.5' />
    </div>
  );
}
