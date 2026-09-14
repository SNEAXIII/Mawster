'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import {
  updateChampionAlias,
  deleteChampion,
  toggleChampionSevenStars,
  toggleChampionAscendable,
  toggleChampionPrefight,
  setChampionSagaRole,
  exportAllChampions,
  loadChampions,
  type Champion,
} from '@/app/services/champions'
import { useI18n } from '@/app/i18n'
import { requiresSeason, type ChampionAttribute } from './champion-attributes'

export interface ChampionImportEntry {
  name: string
  champion_class: string
  image_url?: string | null
  alias?: string | null
  is_7_stars_available?: boolean
  is_ascendable?: boolean
  has_prefight?: boolean
}

const TOGGLE_CALLS = {
  is_7_stars_available: toggleChampionSevenStars,
  is_ascendable: toggleChampionAscendable,
  has_prefight: toggleChampionPrefight,
} as const

interface UseChampionActionsArgs {
  champions: Champion[]
  setChampions: Dispatch<SetStateAction<Champion[]>>
  selectedSeasonId: string | null
  reload: () => Promise<void>
}

export function useChampionActions({
  champions,
  setChampions,
  selectedSeasonId,
  reload,
}: UseChampionActionsArgs) {
  const { t } = useI18n()

  /** Applies the change locally, settles on the API's flags, or restores the list on refusal. */
  const applyOptimistic = useCallback(
    async (
      championId: string,
      patch: Partial<Champion>,
      call: () => Promise<Partial<Champion>>
    ) => {
      const previous = champions
      const patchChampion = (values: Partial<Champion>) =>
        setChampions((prev) => prev.map((c) => (c.id === championId ? { ...c, ...values } : c)))
      patchChampion(patch)
      try {
        patchChampion(await call())
      } catch {
        setChampions(previous)
        toast.error(t.champions.errors.toggleError)
      }
    },
    [champions, setChampions, t.champions.errors.toggleError]
  )

  function toggleAttribute(champion: Champion, attribute: ChampionAttribute) {
    const next = !champion[attribute]

    if (requiresSeason(attribute)) {
      if (!selectedSeasonId) return
      const body = {
        is_saga_attacker: attribute === 'is_saga_attacker' ? next : champion.is_saga_attacker,
        is_saga_defender: attribute === 'is_saga_defender' ? next : champion.is_saga_defender,
      }
      return applyOptimistic(champion.id, { [attribute]: next }, () =>
        setChampionSagaRole(selectedSeasonId, champion.id, body)
      )
    }

    const call = TOGGLE_CALLS[attribute as keyof typeof TOGGLE_CALLS]
    return applyOptimistic(champion.id, { [attribute]: next }, () => call(champion.id))
  }

  async function saveAlias(championId: string, alias: string) {
    try {
      await updateChampionAlias(championId, alias || null)
      setChampions((prev) =>
        prev.map((c) => (c.id === championId ? { ...c, alias: alias || null } : c))
      )
      return true
    } catch {
      toast.error(t.champions.errors.aliasError)
      return false
    }
  }

  async function removeChampion(champion: Champion) {
    try {
      await deleteChampion(champion.id)
      await reload()
    } catch {
      toast.error(t.champions.errors.deleteError)
    }
  }

  const exportChampions = () => exportAllChampions()

  async function importChampions(entries: ChampionImportEntry[]) {
    await loadChampions(
      entries.map((c) => ({
        name: c.name,
        champion_class: c.champion_class,
        image_url: c.image_url ?? null,
        alias: c.alias ?? null,
        is_7_stars_available: c.is_7_stars_available,
        is_ascendable: c.is_ascendable,
        has_prefight: c.has_prefight,
      }))
    )
    await reload()
  }

  return { toggleAttribute, saveAlias, removeChampion, exportChampions, importChampions }
}
