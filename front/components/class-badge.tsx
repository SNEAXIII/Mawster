'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/app/lib/utils';

/** Light badge colors for champion classes (admin table / list display) */
const CLASS_BADGE_COLORS: Record<string, string> = {
  Science: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  Cosmic: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  Mutant: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  Skill: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  Tech: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  Mystic: 'bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100',
};

type ClassBadgeProps = Readonly<{
  championClass: string;
  className?: string;
}>;

export function ClassBadge({ championClass, className = '' }: ClassBadgeProps) {
  const colors = CLASS_BADGE_COLORS[championClass] || 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100';
  return (
    <Badge variant="outline" className={cn(colors, className)}>
      {championClass}
    </Badge>
  );
}
