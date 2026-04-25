'use client';

import { cn } from '@/app/lib/utils';
import { Zap } from 'lucide-react';

export default function SynergyBadge({
  additionalClasses = '',
}: Readonly<{ additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-0.5 flex items-center justify-center',
        additionalClasses
      )}
    >
      <Zap className='w-2.5 h-2.5' />
    </div>
  );
}
