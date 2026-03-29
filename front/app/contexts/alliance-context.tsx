'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { type Alliance, getMyAlliances } from '@/app/services/game';

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
  alliances: Alliance[];
  hasAlliance: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  /** @deprecated use refresh() */
  refreshHasAlliance: () => Promise<void>;
}

const AllianceContext = createContext<AllianceContextValue>({
  alliances: [],
  hasAlliance: false,
  loading: true,
  refresh: async () => {},
  refreshHasAlliance: async () => {},
});

export function AllianceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: session, status } = useSession();
  const isAuthenticated = !!(session && !session.error && session.user);
  const [alliances, setAlliances] = useState<Alliance[]>(() => readCache());
  const [loading, setLoading] = useState(status === 'loading');

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setAlliances([]);
      writeCache([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getMyAlliances();
      setAlliances(data);
      writeCache(data);
    } catch {
      setAlliances([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (status === 'loading') return;
    refresh();
  }, [refresh, status]);

  const contextValue = useMemo(
    () => ({
      alliances,
      hasAlliance: alliances.length > 0,
      loading,
      refresh,
      refreshHasAlliance: refresh,
    }),
    [alliances, loading, refresh]
  );

  return <AllianceContext.Provider value={contextValue}>{children}</AllianceContext.Provider>;
}

export function useAllianceContext() {
  return useContext(AllianceContext);
}
