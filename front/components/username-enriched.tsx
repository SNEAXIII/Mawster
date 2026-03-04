'use client';

import React from 'react';
import { Crown, Shield } from 'lucide-react';
import { cn } from '@/app/lib/utils';

export type MemberRole = 'owner' | 'officer' | 'member';

interface UsernameEnrichedProps {
  pseudo: string;
  role?: MemberRole;
  group?: number | null;
  isMine?: boolean;
  className?: string;
  /** Text size class override — defaults to text-sm */
  textSize?: string;
}

/**
 * Enriched username display:
 *   [G1] 👑 Mr DrBalise
 *
 * - Crown (yellow) for leaders
 * - Shield (purple) for officers
 * - [GX] prefix when group is set
 * - Highlighted style when isMine
 */
export default function UsernameEnriched({
  pseudo,
  role = 'member',
  group,
  isMine = false,
  className,
  textSize = 'text-sm',
}: UsernameEnrichedProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        textSize,
        isMine
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent font-semibold'
          : 'text-foreground',
        className,
      )}
    >
      {group != null && (
        <span className="text-[10px] font-bold text-muted-foreground/70 tracking-tight">
          [G{group}]
        </span>
      )}
      {role === 'owner' && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
      {role === 'officer' && <Shield className="h-3 w-3 text-purple-500 shrink-0" />}
      <span className="truncate">{pseudo}</span>
    </span>
  );
}

/**
 * Helper to derive MemberRole from boolean flags.
 */
export function getMemberRole(isOwner: boolean, isOfficer: boolean): MemberRole {
  if (isOwner) return 'owner';
  if (isOfficer) return 'officer';
  return 'member';
}
