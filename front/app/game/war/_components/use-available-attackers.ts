import { useCallback, useEffect, useState } from 'react'
import type { AvailableAttacker } from '@/app/services/war'

interface AttackerGroup {
  pseudo: string
  gameAccountId: string
  attackers: AvailableAttacker[]
}

export function useAvailableAttackers(
  open: boolean,
  fetchFn: (() => Promise<AvailableAttacker[]>) | null
) {
  const [available, setAvailable] = useState<AvailableAttacker[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
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
      setPlayerSearch('')
      setChampionSearch('')
    }
  }, [open, fetchAvailable])

  function filterBySearch(items: AvailableAttacker[]): AvailableAttacker[] {
    return items.filter((a) => {
      const matchPlayer =
        !playerSearch || a.game_pseudo.toLowerCase().includes(playerSearch.toLowerCase())
      const alias = (a.champion_alias ?? '').toLowerCase()
      const matchChampion =
        !championSearch ||
        a.champion_name.toLowerCase().includes(championSearch.toLowerCase()) ||
        alias.includes(championSearch.toLowerCase())
      return matchPlayer && matchChampion
    })
  }

  function buildGroups(filtered: AvailableAttacker[]): AttackerGroup[] {
    const groupMap = new Map<string, AttackerGroup>()
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
    playerSearch,
    setPlayerSearch,
    championSearch,
    setChampionSearch,
    loading,
    error,
    filterBySearch,
    buildGroups,
  }
}
