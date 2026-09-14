'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import type { Champion } from '@/app/services/champions'
import {
  getAccessibleAlliances,
  importFightRecords,
  type AccessibleAlliance,
  type ImportRow,
} from '@/app/services/fight-records'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { loadChampionCatalog } from '@/hooks/use-champion-catalog'

export function useCsvImport() {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const { roles } = useAllianceContext()
  const [champions, setChampions] = useState<Champion[]>([])
  const [accessibleAlliances, setAccessibleAlliances] = useState<AccessibleAlliance[]>([])
  const [selectedAllianceId, setSelectedAllianceId] = useState<string | null>(null)
  const [resourcesLoaded, setResourcesLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  /** Loads the catalog and the importable alliances once; returns the catalog. */
  const ensureResources = async (): Promise<Champion[]> => {
    if (resourcesLoaded) return champions
    const [champs, accessibleAlliances] = await Promise.all([
      loadChampionCatalog(),
      getAccessibleAlliances(),
    ])
    setChampions(champs)
    setAccessibleAlliances(accessibleAlliances)
    setResourcesLoaded(true)
    return champs
  }

  // Derived from the shared roles so a role change is reflected without refetching.
  const alliances = useMemo(
    () => accessibleAlliances.filter((a) => roles[a.id]?.is_owner || roles[a.id]?.is_officer),
    [accessibleAlliances, roles]
  )

  useEffect(() => {
    if (alliances.length === 1) setSelectedAllianceId((current) => current ?? alliances[0].id)
  }, [alliances])

  const submitImport = async (rows: ImportRow[]) => {
    if (!selectedAllianceId) return false
    setLoading(true)
    try {
      const res = await importFightRecords(selectedAllianceId, { rows })
      toast.success(kb.importSuccess.replace('{count}', String(res.imported)))
      if (res.skipped > 0) toast.info(kb.importSkipped.replace('{count}', String(res.skipped)))
      return true
    } catch {
      toast.error(kb.importError)
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    champions,
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    loading,
    ensureResources,
    submitImport,
  }
}
