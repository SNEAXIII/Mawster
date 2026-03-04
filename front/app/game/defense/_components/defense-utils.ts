/**
 * Shared utilities for defense-related components.
 */

import type { BgMember } from '@/app/services/defense';

// ─── Rarity ──────────────────────────────────────────────

/** Parse a rarity string like "7r4" → { stars, rank }. */
export function parseRarity(rarity: string): { stars: number; rank: number } {
  const m = rarity.match(/^(\d+)r(\d+)$/i);
  if (!m) return { stars: 0, rank: 0 };
  return { stars: parseInt(m[1], 10), rank: parseInt(m[2], 10) };
}

/**
 * Tailwind text-colour class for a rarity string:
 *   - 7r5 → blue
 *   - 7r4 → green
 *   - anything else → red
 */
export function rarityBadgeClass(rarity: string): string {
  const { stars, rank } = parseRarity(rarity);
  if (stars === 7 && rank === 5) return 'text-blue-400';
  if (stars === 7 && rank === 4) return 'text-green-400';
  return 'text-red-400';
}

/** Human-readable label: "7★R4 · 200" */
export function rarityLabel(rarity: string, signature: number): string {
  const { stars, rank } = parseRarity(rarity);
  return `${stars}★R${rank}·${signature}`;
}

// ─── Member role ─────────────────────────────────────────

/** Numeric sort weight: owner (0) < officer (1) < member (2). */
export function memberRoleOrder(member: BgMember): number {
  if (member.is_owner) return 0;
  if (member.is_officer) return 1;
  return 2;
}
