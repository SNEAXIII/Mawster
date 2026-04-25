'use client';

import { cn } from '@/app/lib/utils';

export default function AscensionBadge({
  level,
  additionalClasses = '',
}: Readonly<{ level: 1 | 2; additionalClasses?: string }>) {
  return (
    <div
      className={cn(
        'absolute top-0 right-0 bg-purple-600 text-white rounded-l text-[8px] font-bold leading-none px-0.5 py-0.5 flex items-center justify-center',
        additionalClasses
      )}
      data-cy={`ascension-badge-${level}`}
    >
      {/* TODO ADD le vrai */}A{level}
    </div>
  );
}
