'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getMyAlliances } from '@/app/services/game';

interface AllianceContextValue {
  hasAlliance: boolean;
  refreshHasAlliance: () => Promise<void>;
}

const AllianceContext = createContext<AllianceContextValue>({
  hasAlliance: false,
  refreshHasAlliance: async () => {},
});

export function AllianceProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const isAuthenticated = !!(session && !session.error && session.user);
  const [hasAlliance, setHasAlliance] = useState(false);

  const refreshHasAlliance = useCallback(async () => {
    if (!isAuthenticated) {
      setHasAlliance(false);
      return;
    }
    try {
      const alliances = await getMyAlliances();
      setHasAlliance(alliances.length > 0);
    } catch {
      setHasAlliance(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshHasAlliance();
  }, [refreshHasAlliance]);

  return (
    <AllianceContext.Provider value={{ hasAlliance, refreshHasAlliance }}>
      {children}
    </AllianceContext.Provider>
  );
}

export function useAllianceContext() {
  return useContext(AllianceContext);
}
