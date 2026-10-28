'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'
import { parseRarity } from '@/app/game/defense/_components/defense-utils'
import { RARITIES, rarityIndex } from '@/app/services/roster'
import { placeWarDefender, removeWarDefender, type WarPlacement } from '@/app/services/war'
import { useLastDefenderRarity } from '../use-last-defender-rarity'
import { clamp, type Draft, type Range } from './quick-edit-logic'
import { useQuickEditSaves } from './use-quick-edit-saves'

interface PendingConfirm {
  title: string
  description: string
  apply: () => void
}

interface QuickEditActionsInput {
  byNode: Map<number, WarPlacement>
  ascendable: Set<string>
  rankRange: Range
  ascRange: Range
}

/** Writes of the quick edit: debounced placements, removals, and the attacker guard. */
export function useQuickEditActions({
  byNode,
  ascendable,
  rankRange,
  ascRange,
}: QuickEditActionsInput) {
  const { t } = useI18n()
  const w = t.game.war
  const { selectedAllianceId, activeWarId, selectedBg, reloadWarSilently, write } = useWar()
  const { last, remember } = useLastDefenderRarity()
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)

  const saves = useQuickEditSaves(
    {
      place: async (to, node, draft) => {
        const { stars, rank } = parseRarity(RARITIES[draft.rankIndex])
        const canAscend = ascendable.has(draft.championId)
        try {
          await write(() =>
            placeWarDefender(to.allianceId, to.warId, to.bg, {
              node_number: node,
              champion_id: draft.championId,
              stars,
              rank,
              ascension: canAscend ? draft.ascension : 0,
            })
          )
        } catch (err) {
          toast.error(w.placeError)
          throw err
        } finally {
          reloadWarSilently()
        }
        remember((prev) => ({
          stars,
          rank,
          ascension: canAscend ? draft.ascension : prev.ascension,
        }))
      },
      remove: async (to, node) => {
        try {
          await write(() => removeWarDefender(to.allianceId, to.warId, to.bg, node))
        } catch (err) {
          toast.error(w.removeError)
          throw err
        } finally {
          // Success or not, the map must show what the server now holds.
          reloadWarSilently()
        }
      },
    },
    { allianceId: selectedAllianceId, warId: activeWarId, bg: selectedBg }
  )

  // An attacker on the node is lost when its defender changes or leaves.
  const guard = (node: number, title: string, description: string, apply: () => void) => {
    if (byNode.get(node)?.attacker_champion_user_id) setConfirm({ title, description, apply })
    else apply()
  }

  const remove = (node: number) =>
    guard(node, w.removeDefenderWithAttackerTitle, w.removeDefenderWithAttackerDesc, () => {
      void saves.remove(node, byNode.has(node))
    })

  const pick = (node: number, current: Draft | null, championId: string | null) => {
    if (championId === null) return remove(node)
    if (championId === current?.championId) return
    const base = current ?? {
      rankIndex: clamp(rarityIndex(`${last.stars}r${last.rank}`), rankRange),
      ascension: clamp(last.ascension, ascRange),
    }
    // The disabled slider of a non-ascendable champion must show what is saved: A0.
    const ascension = ascendable.has(championId) ? base.ascension : 0
    const draft: Draft = { championId, rankIndex: base.rankIndex, ascension }
    const placed = byNode.get(node)?.champion_id
    const apply = () => saves.edit(node, draft)
    if (placed && placed !== championId) {
      guard(node, w.replaceDefenderWithAttackerTitle, w.replaceDefenderWithAttackerDesc, apply)
    } else apply()
  }

  return { saves, confirm, setConfirm, pick, remove }
}
