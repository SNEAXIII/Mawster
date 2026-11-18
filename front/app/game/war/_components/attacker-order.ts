import type { AttackPreference } from '@/app/services/roster'
import { rarityWeight } from '@/app/game/_components/use-rarity-filter'

const PREFERENCE_RANK: Record<AttackPreference, number> = { preferred: 0, neutral: 1, detested: 2 }

interface Orderable {
  attack_preference: AttackPreference
  rarity: string
}

/** Preferred first, Detested last, then rarity descending. */
export function compareAttackers(a: Orderable, b: Orderable): number {
  return (
    PREFERENCE_RANK[a.attack_preference] - PREFERENCE_RANK[b.attack_preference] ||
    rarityWeight(b.rarity) - rarityWeight(a.rarity)
  )
}
