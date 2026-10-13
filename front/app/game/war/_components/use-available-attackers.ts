import { useCallback, useEffect, useState } from 'react'
import type { AvailableAttacker, AvailablePrefightAttacker } from '@/app/services/war'
import { splitRarity } from '@/app/services/roster'

interface AttackerGroup<T> {
  pseudo: string
  gameAccountId: string
  attackers: T[]
}

function copyStrength(a: AvailableAttacker): number[] {
  const split = splitRarity(a.rarity)
  return [split?.stars ?? 0, split?.rank ?? 0, a.ascension]
}

function isStronger(a: AvailableAttacker, b: AvailableAttacker): boolean {
  const [sa, sb] = [copyStrength(a), copyStrength(b)]
  const i = sa.findIndex((v, k) => v !== sb[k])
  return i !== -1 && sa[i] > sb[i]
}

/** One entry per player and champion: the highest copy stands for the duplicates. */
export function keepBestCopy(items: AvailableAttacker[]): AvailableAttacker[] {
  const best = new Map<string, AvailableAttacker>()
  for (const a of items) {
    const key = `${a.game_account_id}:${a.champion_id}`
    const kept = best.get(key)
    if (!kept || isStronger(a, kept)) best.set(key, a)
  }
  return Array.from(best.values())
}

export function useAvailableAttackers<T extends AvailablePrefightAttacker>(
  open: boolean,
  fetchFn: (() => Promise<T[]>) | null
) {
  const [available, setAvailable] = useState<T[]>([])
  const [playerFilter, setPlayerFilter] = useState('')
  const [championSearch, setChampionSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchAvailable = useCallback(async () => {
    if (!fetchFn) return
    setLoading(true)
    setError(false)
    try {
      const data = await fetchFn()
      setAvailable(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    if (open) {
      void fetchAvailable()
      setPlayerFilter('')
      setChampionSearch('')
    }
  }, [open, fetchAvailable])

  const players = Array.from(new Set(available.map((a) => a.game_pseudo)))

  function filterBySearch(items: T[]): T[] {
    const q = championSearch.toLowerCase()
    return items.filter((a) => {
      const matchPlayer = !playerFilter || a.game_pseudo === playerFilter
      const matchChampion =
        !q ||
        a.champion_name.toLowerCase().includes(q) ||
        (a.champion_alias ?? '').toLowerCase().includes(q)
      return matchPlayer && matchChampion
    })
  }

  function buildGroups(filtered: T[]): AttackerGroup<T>[] {
    const groupMap = new Map<string, AttackerGroup<T>>()
    for (const a of filtered) {
      let group = groupMap.get(a.game_account_id)
      if (!group) {
        group = { pseudo: a.game_pseudo, gameAccountId: a.game_account_id, attackers: [] }
        groupMap.set(a.game_account_id, group)
      }
      group.attackers.push(a)
    }
    return Array.from(groupMap.values())
  }

  return {
    available,
    players,
    playerFilter,
    setPlayerFilter,
    championSearch,
    setChampionSearch,
    loading,
    error,
    filterBySearch,
    buildGroups,
  }
}
