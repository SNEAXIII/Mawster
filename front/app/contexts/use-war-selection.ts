'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { type War, getWars } from '@/app/services/war'

/** Running War first, then correctable closed Wars, newest first. */
function selectableWars(all: War[]): War[] {
  return all
    .filter((w) => w.is_map_correctable)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.created_at.localeCompare(a.created_at)
    })
}

/** The Wars the War page can show for one alliance, and the one on screen. */
export function useWarSelection(allianceId: string) {
  const { t } = useI18n()
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const [allWars, setAllWars] = useState<War[]>([])
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)

  const wars = useMemo(() => selectableWars(allWars), [allWars])
  const currentWar = useMemo(
    () => wars.find((w) => w.id === selectedWarId) ?? null,
    [wars, selectedWarId]
  )
  const hasActiveWar = allWars.some((w) => w.status === 'active')

  /** Reloads the list; keeps `keepWarId` on screen if still selectable, else the default. */
  const fetchWars = useCallback(
    async (keepWarId?: string) => {
      if (!allianceId) return
      const seq = ++requestSeq.current
      setLoading(true)
      try {
        const list = await getWars(allianceId)
        if (seq !== requestSeq.current) return
        const selectable = selectableWars(list)
        const kept = selectable.find((w) => w.id === keepWarId)
        setAllWars(list)
        setSelectedWarId((kept ?? selectable[0])?.id ?? null)
      } catch (err: unknown) {
        // 403: a foreign alliance from a shared link, which the auto-select is about to replace.
        if ((err as { status?: number }).status !== 403)
          toast.error(tRef.current.game.war.loadError)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [allianceId]
  )

  useEffect(() => {
    setAllWars([])
    setSelectedWarId(null)
    void fetchWars()
  }, [fetchWars])

  /** Puts a War returned by a write into the list and shows it. */
  const showWar = useCallback((war: War) => {
    setAllWars((prev) => [...prev.filter((w) => w.id !== war.id), war])
    setSelectedWarId(war.id)
  }, [])

  return {
    wars,
    selectedWarId,
    setSelectedWarId,
    currentWar,
    hasActiveWar,
    loading,
    fetchWars,
    showWar,
  }
}
