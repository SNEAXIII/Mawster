'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseRarity } from '@/app/game/defense/_components/defense-utils';

const STORAGE_KEY = 'mawster:war-attacker-rarity-tiers';

/** Selectable rarity tiers, ordered low → high. */
export const RARITY_TIERS = ['6r4', '6r5', '7r1', '7r2', '7r3', '7r4', '7r5', '7r6'] as const;

/** Default when no stored preference: 7★ shown, 6★ hidden. */
const DEFAULT_TIERS = RARITY_TIERS.filter((t) => t.startsWith('7'));

/** Sort weight for a rarity string: 7r6 (706) → 6r4 (604). */
export function rarityWeight(rarity: string): number {
  const { stars, rank } = parseRarity(rarity);
  return stars * 100 + rank;
}

function loadTiers(): Set<string> {
  if (typeof window === 'undefined') return new Set(DEFAULT_TIERS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_TIERS);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((t) => typeof t === 'string'));
  } catch {
    // Corrupt / unavailable storage — fall back to default.
  }
  return new Set(DEFAULT_TIERS);
}

/**
 * Manages the active rarity-tier filter for the war attacker selector.
 * Persisted in localStorage, independent of dialog open/close, and untouched
 * by the "Reset filters" action.
 */
export function useAttackerRarityFilter() {
  const [activeTiers, setActiveTiers] = useState<Set<string>>(() => new Set(DEFAULT_TIERS));

  // Hydrate from storage on mount (avoids SSR mismatch).
  useEffect(() => {
    setActiveTiers(loadTiers());
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setActiveTiers(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Ignore storage failures (private browsing).
    }
  }, []);

  const toggleTier = useCallback(
    (tier: string) => {
      const next = new Set(activeTiers);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      persist(next);
    },
    [activeTiers, persist]
  );

  const matches = useCallback(
    (rarity: string) => {
      const { stars, rank } = parseRarity(rarity);
      return activeTiers.has(`${stars}r${rank}`);
    },
    [activeTiers]
  );

  return useMemo(
    () => ({ activeTiers, toggleTier, matches }),
    [activeTiers, toggleTier, matches]
  );
}
