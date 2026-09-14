'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import type { Champion } from '@/app/services/champions'
import {
  getAccessibleAlliances,
  importFightRecords,
  type AccessibleAlliance,
  type ImportRow,
} from '@/app/services/fight-records'
import { getMyAllianceRoles } from '@/app/services/game'
import { loadChampionCatalog } from '@/hooks/use-champion-catalog'

export function useCsvImport() {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const [champions, setChampions] = useState<Champion[]>([])
  const [alliances, setAlliances] = useState<AccessibleAlliance[]>([])
  const [selectedAllianceId, setSelectedAllianceId] = useState<string | null>(null)
  const [resourcesLoaded, setResourcesLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  /** Loads the catalog and the importable alliances once; returns the catalog. */
  const ensureResources = async (): Promise<Champion[]> => {
    if (resourcesLoaded) return champions
    const [champs, accessibleAlliances, rolesData] = await Promise.all([
      loadChampionCatalog(),
      getAccessibleAlliances(),
      getMyAllianceRoles(),
    ])
    setChampions(champs)
    const managedAlliances = accessibleAlliances.filter(
      (a) => rolesData.roles[a.id]?.is_owner || rolesData.roles[a.id]?.is_officer
    )
    setAlliances(managedAlliances)
    if (managedAlliances.length === 1) setSelectedAllianceId(managedAlliances[0].id)
    setResourcesLoaded(true)
    return champs
  }

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
