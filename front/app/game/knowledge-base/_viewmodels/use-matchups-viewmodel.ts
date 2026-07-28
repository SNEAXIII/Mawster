'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAllianceSelector } from '@/hooks/use-alliance-selector'
import { getMyAllianceRoles, type AllianceMyRoles } from '@/app/services/game'
import { evaluateMatchups, type MatchupEvaluationRow } from '@/app/services/matchups'
import { useMatchupGrid } from './use-matchup-grid'
import { useMatchupDefenderGrid } from './use-matchup-defender-grid'
import { useMatchupRatings } from './use-matchup-ratings'

export interface MatchupFiltersState {
  championId: string | null
  defenderChampionId: string | null
  nodeNumber: string
  gameAccountId: string
}

const EMPTY_FILTERS: MatchupFiltersState = {
  championId: null,
  defenderChampionId: null,
  nodeNumber: '',
  gameAccountId: '',
}

export function useMatchupsViewModel() {
  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    loading: alliancesLoading,
  } = useAllianceSelector()
  const [filters, setFilters] = useState<MatchupFiltersState>(EMPTY_FILTERS)
  const [rows, setRows] = useState<MatchupEvaluationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preselect the first alliance once they load, like the defense and war pages do.
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliances])

  // Attacker picked alone (no defender/node target): mutually exclusive with hasTarget below,
  // since it requires both defenderChampionId and nodeNumber to be empty.
  const showGrid =
    filters.championId !== null && filters.defenderChampionId === null && filters.nodeNumber === ''
  // Mirror of showGrid: a defender picked alone yields the attacker x nodes grid instead.
  const showDefenderGrid =
    filters.defenderChampionId !== null && filters.championId === null && filters.nodeNumber === ''
  const hasTarget = filters.defenderChampionId !== null || filters.nodeNumber !== ''
  const showEvaluation = hasTarget && !showDefenderGrid

  const reload = useCallback(async () => {
    if (!selectedAllianceId || !showEvaluation) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await evaluateMatchups(selectedAllianceId, {
        champion_id: filters.championId,
        defender_champion_id: filters.defenderChampionId,
        node_number: filters.nodeNumber === '' ? null : Number(filters.nodeNumber),
        game_account_id: filters.gameAccountId || null,
      })
      setRows(result)
    } catch {
      setError('load-failed')
    } finally {
      setLoading(false)
    }
  }, [selectedAllianceId, showEvaluation, filters])

  useEffect(() => {
    void reload()
  }, [reload])

  const {
    grid,
    loading: gridLoading,
    error: gridError,
    reload: reloadGrid,
  } = useMatchupGrid(selectedAllianceId, showGrid, filters.championId, filters.gameAccountId)

  const {
    grid: defenderGrid,
    loading: defenderGridLoading,
    error: defenderGridError,
    reload: reloadDefenderGrid,
  } = useMatchupDefenderGrid(
    selectedAllianceId,
    showDefenderGrid,
    filters.defenderChampionId,
    filters.gameAccountId
  )

  const setFilter = useCallback(
    <K extends keyof MatchupFiltersState>(key: K, value: MatchupFiltersState[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    []
  )

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  // Officers editing ratings need both read views refreshed, whichever one is on screen.
  const reloadActive = useCallback(
    async () => void (await Promise.all([reload(), reloadGrid(), reloadDefenderGrid()])),
    [reload, reloadGrid, reloadDefenderGrid]
  )
  // Shared with MatchupForm so the officer add-zone's rating list reacts as they pick an
  // attacker in the entry form, instead of dumping every rating in the alliance.
  const [matchupAttackerId, setMatchupAttackerId] = useState<string | null>(null)
  const {
    ratings: similarRatings,
    saveMatchup,
    removeMatchup,
  } = useMatchupRatings(selectedAllianceId, matchupAttackerId, reloadActive)

  const [roles, setRoles] = useState<AllianceMyRoles['roles']>({})
  useEffect(() => {
    getMyAllianceRoles()
      .then((result) => setRoles(result.roles))
      .catch(() => setRoles({}))
  }, [])

  // Only officers and the owner may write. A plain member reads like everyone else, so
  // showing them a form that the API answers with 403 would be a lie.
  const canEdit = Boolean(selectedAllianceId && roles[selectedAllianceId]?.can_manage)

  return {
    alliances,
    allianceId: selectedAllianceId,
    setAllianceId: setSelectedAllianceId,
    alliancesLoading,
    filters,
    setFilter,
    clearFilters,
    hasTarget,
    showGrid,
    showDefenderGrid,
    grid,
    defenderGrid,
    rows,
    loading: showGrid ? gridLoading : showDefenderGrid ? defenderGridLoading : loading,
    error: showGrid ? gridError : showDefenderGrid ? defenderGridError : error,
    reload,
    canEdit,
    similarRatings,
    matchupAttackerId,
    setMatchupAttackerId,
    saveMatchup,
    removeMatchup,
  }
}
