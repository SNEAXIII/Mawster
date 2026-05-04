'use client';

import { cn } from '@/app/lib/utils';
import { Flame } from 'lucide-react';

export default function PrefightBadge({
  additionalClasses = '',
}: Readonly<{ additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-0.5 flex items-center justify-center',
        additionalClasses
      )}
    >
      <Flame className='w-2.5 h-2.5' />
    </div>
  );
}
