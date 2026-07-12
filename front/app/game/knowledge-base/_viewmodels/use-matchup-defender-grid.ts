'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMatchupDefenderGrid, type MatchupDefenderGridResponse } from '@/app/services/matchups';

/**
 * Mirror of {@link useMatchupGrid}, centered on a defender: loads the attackers rated against
 * it. Split out so the viewmodel stays under the line budget; the caller decides when
 * `enabled` (showDefenderGrid) is true.
 */
export function useMatchupDefenderGrid(
  allianceId: string,
  enabled: boolean,
  defenderChampionId: string | null,
  gameAccountId: string
) {
  const [grid, setGrid] = useState<MatchupDefenderGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!allianceId || !enabled || !defenderChampionId) {
      setGrid(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setGrid(await getMatchupDefenderGrid(allianceId, defenderChampionId, gameAccountId || null));
    } catch {
      setError('load-failed');
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [allianceId, enabled, defenderChampionId, gameAccountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { grid, loading, error, reload };
}
