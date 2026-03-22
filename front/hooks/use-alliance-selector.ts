import { useCallback, useEffect, useState } from 'react';
import { type Alliance, getMyAlliances } from '@/app/services/game';

export interface UseAllianceSelectorOptions {
  initialAllianceId?: string;
  initialBg?: number;
}

export interface UseAllianceSelectorReturn {
  alliances: Alliance[];
  selectedAllianceId: string;
  setSelectedAllianceId: (id: string) => void;
  selectedBg: number;
  setSelectedBg: (bg: number) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAllianceSelector(
  options: UseAllianceSelectorOptions = {}
): UseAllianceSelectorReturn {
  const { initialAllianceId = '', initialBg = 1 } = options;

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId);
  const [selectedBg, setSelectedBg] = useState<number>(initialBg);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAlliances();
      setAlliances(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
    refresh,
  };
}
