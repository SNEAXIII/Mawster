'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteMatchup,
  getMatchups,
  upsertMatchup,
  type MatchupRating,
  type MatchupUpsertBody,
} from '@/app/services/matchups';

/**
 * Saved matchup ratings CRUD (used by the officer edit form/table). Split out of
 * `useMatchupsViewModel` to keep both files under the line budget. `onMutated` is the
 * caller's evaluation/grid reload, chained after every write so the read views stay in sync.
 */
export function useMatchupRatings(allianceId: string, onMutated: () => Promise<void>) {
  const [ratings, setRatings] = useState<MatchupRating[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRatings = useCallback(async () => {
    if (!allianceId) {
      setRatings([]);
      return;
    }
    try {
      setRatings(await getMatchups(allianceId));
    } catch {
      setError('load-failed');
    }
  }, [allianceId]);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const saveMatchup = useCallback(
    async (body: MatchupUpsertBody) => {
      if (!allianceId) return;
      await upsertMatchup(allianceId, body);
      await Promise.all([loadRatings(), onMutated()]);
    },
    [allianceId, loadRatings, onMutated]
  );

  const removeMatchup = useCallback(
    async (ratingId: string) => {
      if (!allianceId) return;
      await deleteMatchup(allianceId, ratingId);
      await Promise.all([loadRatings(), onMutated()]);
    },
    [allianceId, loadRatings, onMutated]
  );

  return { ratings, ratingsError: error, saveMatchup, removeMatchup };
}
