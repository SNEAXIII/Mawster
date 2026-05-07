'use client';

import { cn } from '@/app/lib/utils';

export default function AscensionBadge({
  level,
  additionalClasses = '',
  size,
}: Readonly<{ level: 1 | 2; additionalClasses?: string; size: number }>) {
  return (
    <div
      className={cn(
        'absolute top-0 right-0 rounded-l font-bold leading-none px-0.5 py-0.5 flex items-center justify-center',
        additionalClasses
      )}
      data-cy={`ascension-badge-${level}`}
      style={{ translate: Math.round(size / 2.5) }}
    >
      <img
        src={`/static/frame/ascended_${level}.png`}
        alt=''
        width={size}
        height={size}
      />
    </div>
  );
}
