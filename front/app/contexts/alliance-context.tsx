'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  type Alliance,
  type AllianceRoleEntry,
  type AllianceInvitation,
  getMyAlliances,
  getMyVisitedAlliances,
  getMyAllianceRoles,
  getMyInvitations,
  getAllianceInvitations,
} from '@/app/services/game';

const CACHE_KEY = 'alliance_cache';

function readCache(): Alliance[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Alliance[]) : [];
  } catch {
    return [];
  }
}

function writeCache(alliances: Alliance[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(alliances));
  } catch (_) {
    // localStorage unavailable (SSR, private browsing)
  }
}

interface AllianceContextValue {
  // Alliances
  alliances: Alliance[];
  hasAlliance: boolean;
  loading: boolean;
  // Roles
  roles: Record<string, AllianceRoleEntry>;
  myAccountIds: Set<string>;
  isMine: (gameAccountId: string) => boolean;
  isOwner: (alliance: Alliance) => boolean;
  canManage: (alliance: Alliance) => boolean;
  getRoleFor: (allianceId: string) => AllianceRoleEntry | undefined;
  rolesLoading: boolean;
  // Invitations
  myInvitations: AllianceInvitation[];
  pendingInvitations: Record<string, AllianceInvitation[]>;
  // Actions
  refresh: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  /** @deprecated use refresh() */
  refreshHasAlliance: () => Promise<void>;
}

const AllianceContext = createContext<AllianceContextValue>({
  alliances: [],
  hasAlliance: false,
  loading: true,
  roles: {},
  myAccountIds: new Set(),
  isMine: () => false,
  isOwner: () => false,
  canManage: () => false,
  getRoleFor: () => undefined,
  rolesLoading: true,
  myInvitations: [],
  pendingInvitations: {},
  refresh: async () => {},
  refreshRoles: async () => {},
  refreshHasAlliance: async () => {},
});

export function AllianceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: session, status } = useSession();
  const isAuthenticated = !!(session && !session.error && session.user);

  const [alliances, setAlliances] = useState<Alliance[]>(() => readCache());
  const [loading, setLoading] = useState(status === 'loading');
  const [roles, setRoles] = useState<Record<string, AllianceRoleEntry>>({});
  const [myAccountIds, setMyAccountIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [myInvitations, setMyInvitations] = useState<AllianceInvitation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Record<string, AllianceInvitation[]>>({});

  const refreshRoles = useCallback(async () => {
    if (!isAuthenticated) return;
    setRolesLoading(true);
    try {
      const data = await getMyAllianceRoles();
      setRoles(data.roles);
      setMyAccountIds(data.my_account_ids);
    } catch {
      // silent
    } finally {
      setRolesLoading(false);
    }
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setAlliances([]);
      writeCache([]);
      setLoading(false);
      setRoles({});
      setMyAccountIds([]);
      setRolesLoading(false);
      setMyInvitations([]);
      setPendingInvitations({});
      return;
    }

    setLoading(true);
    setRolesLoading(true);

    try {
      const [memberResult, visitedResult, rolesResult, invitationsResult] = await Promise.all([
        getMyAlliances(),
        getMyVisitedAlliances(),
        getMyAllianceRoles(),
        getMyInvitations(),
      ]);

      const merged = [
        ...memberResult,
        ...visitedResult.filter((v) => !memberResult.some((m) => m.id === v.id)),
      ];
      setAlliances(merged);
      writeCache(merged);

      setRoles(rolesResult.roles);
      setMyAccountIds(rolesResult.my_account_ids);
      setMyInvitations(invitationsResult);

      // Fetch pending invitations only for alliances the user can manage
      const manageable = merged.filter((a) => rolesResult.roles[a.id]?.can_manage);
      const pending: Record<string, AllianceInvitation[]> = {};
      await Promise.all(
        manageable.map(async (alliance) => {
          try {
            const items = await getAllianceInvitations(alliance.id);
            if (items.length > 0) pending[alliance.id] = items;
          } catch {
            // ignore per-alliance failure
          }
        })
      );
      setPendingInvitations(pending);
    } catch {
      setAlliances([]);
    } finally {
      setLoading(false);
      setRolesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (status === 'loading') return;
    refresh();
  }, [refresh, status]);

  const accountIdSet = useMemo(() => new Set(myAccountIds), [myAccountIds]);

  const contextValue = useMemo<AllianceContextValue>(
    () => ({
      alliances,
      hasAlliance: alliances.length > 0,
      loading,
      roles,
      myAccountIds: accountIdSet,
      isMine: (gameAccountId: string) => accountIdSet.has(gameAccountId),
      isOwner: (alliance: Alliance) => roles[alliance.id]?.is_owner ?? false,
      canManage: (alliance: Alliance) => roles[alliance.id]?.can_manage ?? false,
      getRoleFor: (allianceId: string) => roles[allianceId],
      rolesLoading,
      myInvitations,
      pendingInvitations,
      refresh,
      refreshRoles,
      refreshHasAlliance: refresh,
    }),
    [alliances, loading, roles, accountIdSet, rolesLoading, myInvitations, pendingInvitations, refresh, refreshRoles]
  );

  return <AllianceContext.Provider value={contextValue}>{children}</AllianceContext.Provider>;
}

export function useAllianceContext() {
  return useContext(AllianceContext);
}
