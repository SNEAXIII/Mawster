'use client';

import { cn } from '@/app/lib/utils';

export default function SagaBadge({ additionalClasses = '' }: Readonly<{ additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute left-0 top-1/2 -translate-y-1/2 bg-amber-500 text-white rounded-r text-[8px] font-bold leading-none px-0.5 py-0.5 flex items-center justify-center',
        additionalClasses
      )}
      data-cy='saga-badge'
    >
      {/* TODO METTRE UNE IMAGE */}
      S
    </div>
  );
}
