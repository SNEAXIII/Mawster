'use client'

import { useEffect, useState } from 'react'
import { useGameAccounts } from '@/app/contexts/game-accounts-context'
import { type PlayerDashboard, getPlayerDashboard } from '@/app/services/player-dashboard'

const STORAGE_KEY = 'mawster.dashboard.player'
const REFRESH_COOLDOWN_MS = 10_000

function readStoredPlayer(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** The selected Player, its dashboard, and the cooldown-guarded refresh. */
export function usePlayerDashboard() {
  const {
    accounts,
    loading: accountsLoading,
    loadError: accountsLoadError,
    refresh: refreshAccounts,
  } = useGameAccounts()
  const [picked, setPicked] = useState<string | null>(readStoredPlayer)
  const [dashboard, setDashboard] = useState<PlayerDashboard | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [coolingDown, setCoolingDown] = useState(false)

  const selected =
    accounts.find((a) => a.id === picked) ?? accounts.find((a) => a.is_primary) ?? accounts[0]
  const selectedId = selected?.id ?? null

  const selectPlayer = (id: string) => {
    setPicked(id)
    setDashboard(null)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage blocked: the pick just won't survive a reload.
    }
  }

  useEffect(() => {
    if (!selectedId) return
    let stale = false
    getPlayerDashboard(selectedId)
      .then((data) => !stale && setDashboard(data))
      .catch((err: unknown) => console.error(err))
    return () => {
      stale = true
    }
  }, [selectedId, refreshKey])

  const refresh = () => {
    setRefreshKey((key) => key + 1)
    setCoolingDown(true)
    setTimeout(() => setCoolingDown(false), REFRESH_COOLDOWN_MS)
  }

  // An accepted invitation moves the Player into an Alliance: the picker's account list changes too.
  const afterInvitationAnswered = async () => {
    await refreshAccounts()
    setRefreshKey((key) => key + 1)
  }

  return {
    accounts,
    accountsLoading,
    accountsLoadError,
    selected,
    selectPlayer,
    dashboard,
    refreshKey,
    refresh,
    coolingDown,
    afterInvitationAnswered,
  }
}
