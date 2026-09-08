import { useState } from 'react'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { type AllianceWithVisitorFlag } from '@/app/services/game'

// Re-exported because nine components import the type from here.
export { type AllianceWithVisitorFlag }

export interface UseAllianceSelectorOptions {
  initialAllianceId?: string
  initialBg?: number
}

export interface UseAllianceSelectorReturn {
  alliances: AllianceWithVisitorFlag[]
  selectedAllianceId: string
  setSelectedAllianceId: (id: string) => void
  selectedBg: number
  setSelectedBg: (bg: number) => void
  loading: boolean
  refresh: () => Promise<void>
}

/** Which alliance the page is looking at. The list itself comes from AllianceProvider,
 *  which is mounted app-wide and has already fetched it — this hook used to refetch
 *  `/alliances/mine` and `/alliances/my-visited` on every mount, so the three pages
 *  using it paid for both endpoints twice per page load. */
export function useAllianceSelector(
  options: UseAllianceSelectorOptions = {}
): UseAllianceSelectorReturn {
  const { initialAllianceId = '', initialBg = 1 } = options

  const { alliances, loading, refresh } = useAllianceContext()
  const [selectedAllianceId, setSelectedAllianceId] = useState<string>(initialAllianceId)
  const [selectedBg, setSelectedBg] = useState<number>(initialBg)

  return {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
    refresh,
  }
}
