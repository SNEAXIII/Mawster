import { useCallback, useEffect, useState } from 'react';
import { type Alliance, getMyAlliances, getMyVisitedAlliances } from '@/app/services/game';

export interface AllianceWithVisitorFlag extends Alliance {
  isVisitor: boolean;
}

export interface UseAllianceSelectorOptions {
  initialAllianceId?: string;
  initialBg?: number;
}

export interface UseAllianceSelectorReturn {
  alliances: AllianceWithVisitorFlag[];
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

  const [alliances, setAlliances] = useState<AllianceWithVisitorFlag[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId);
  const [selectedBg, setSelectedBg] = useState<number>(initialBg);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [member, visited] = await Promise.all([getMyAlliances(), getMyVisitedAlliances()]);
      const memberWithFlag: AllianceWithVisitorFlag[] = member.map((a) => ({
        ...a,
        isVisitor: false,
      }));
      const visitedWithFlag: AllianceWithVisitorFlag[] = visited
        .filter((a) => !member.some((m) => m.id === a.id))
        .map((a) => ({ ...a, isVisitor: true }));
      setAlliances([...memberWithFlag, ...visitedWithFlag]);
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
