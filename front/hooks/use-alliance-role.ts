'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  type Alliance,
  type AllianceRoleEntry,
  getMyAllianceRoles,
} from '@/app/services/game';

export interface AllianceRoleAPI {
  /** Current user's game account IDs */
  myAccountIds: Set<string>;
  /** Whether a member is one of the current user's accounts */
  isMine: (gameAccountId: string) => boolean;
  /** Whether the current user owns the given alliance */
  isOwner: (alliance: Alliance) => boolean;
  /** Whether the current user is officer or owner in the given alliance */
  canManage: (alliance: Alliance) => boolean;
  /** Role entry for a specific alliance (or undefined if not a member) */
  getRoleFor: (allianceId: string) => AllianceRoleEntry | undefined;
  /** Whether the data is still loading */
  loading: boolean;
  /** Re-fetch roles from the backend */
  refresh: () => Promise<void>;
}

const AllianceRoleContext = createContext<AllianceRoleAPI | null>(null);

/**
 * Provider that calls `GET /alliances/my-roles` once and exposes
 * role-checking helpers for alliance management.
 *
 * All business logic (owner check, officer check) is done server-side.
 * The frontend simply reads the pre-computed flags.
 */
export function AllianceRoleProvider({
  children,
  refreshKey = 0,
}: {
  children: React.ReactNode;
  /** Increment to re-fetch roles (e.g. after promoting/demoting an officer) */
  refreshKey?: number;
}) {
  const [roles, setRoles] = useState<Record<string, AllianceRoleEntry>>({});
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await getMyAllianceRoles();
      setRoles(data.roles);
      setAccountIds(data.my_account_ids);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [refreshKey]);

  const value = useMemo<AllianceRoleAPI>(() => {
    const ids = new Set(accountIds);

    return {
      myAccountIds: ids,
      isMine: (gameAccountId: string) => ids.has(gameAccountId),
      isOwner: (alliance: Alliance) => roles[alliance.id]?.is_owner ?? false,
      canManage: (alliance: Alliance) => roles[alliance.id]?.can_manage ?? false,
      getRoleFor: (allianceId: string) => roles[allianceId],
      loading,
      refresh: fetchRoles,
    };
  }, [accountIds, roles, loading]);

  return React.createElement(AllianceRoleContext.Provider, { value }, children);
}

/**
 * Hook to access alliance role helpers from any descendant component.
 * Must be used inside an `<AllianceRoleProvider>`.
 */
export function useAllianceRole(): AllianceRoleAPI {
  const ctx = useContext(AllianceRoleContext);
  if (!ctx) {
    throw new Error('useAllianceRole must be used within an <AllianceRoleProvider>');
  }
  return ctx;
}
