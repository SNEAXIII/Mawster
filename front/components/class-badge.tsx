'use client';

import React from 'react';

/** Light badge colors for champion classes (admin table / list display) */
const CLASS_BADGE_COLORS: Record<string, string> = {
  Science: 'bg-green-100 text-green-800',
  Cosmic: 'bg-purple-100 text-purple-800',
  Mutant: 'bg-yellow-100 text-yellow-800',
  Skill: 'bg-red-100 text-red-800',
  Tech: 'bg-blue-100 text-blue-800',
  Mystic: 'bg-pink-100 text-pink-800',
};

type ClassBadgeProps = Readonly<{
  championClass: string;
  className?: string;
}>;

export function ClassBadge({ championClass, className = '' }: ClassBadgeProps) {
  const colors = CLASS_BADGE_COLORS[championClass] || 'bg-gray-100 text-gray-800';
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors} ${className}`}
    >
      {championClass}
    </span>
  );
}
