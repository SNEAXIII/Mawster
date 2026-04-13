'use client';

import { cn } from '@/app/lib/utils';
import Image from 'next/image';

export default function SagaBadge({
  additionalClasses = '',
  size,
}: Readonly<{ additionalClasses?: string; size: number }>) {
  return (
    <div
      className={cn(
        'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
        additionalClasses
      )}
      style={{ left: -Math.round(size / 2.5) }}
      data-cy='saga-badge'
    >
      <Image
        src='/static/frame/current_saga_mini.png'
        alt=''
        width={size}
        height={size}
      ></Image>
    </div>
  );
}
