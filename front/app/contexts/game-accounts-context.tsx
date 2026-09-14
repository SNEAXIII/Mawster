'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import {
  type DeletedGameAccount,
  type GameAccount,
  createGameAccount,
  deleteGameAccount,
  getDeletedGameAccounts,
  getMyGameAccounts,
  restoreGameAccount,
  updateGameAccount,
} from '@/app/services/game'

interface GameAccountsContextValue {
  accounts: GameAccount[]
  deletedAccounts: DeletedGameAccount[]
  /** True until the first load settles. */
  loading: boolean
  loadError: boolean
  refresh: () => Promise<void>
  create: (pseudo: string) => Promise<boolean>
  update: (account: GameAccount, pseudo: string, isPrimary: boolean) => Promise<boolean>
  remove: (account: GameAccount) => Promise<boolean>
  restore: (account: DeletedGameAccount) => Promise<void>
}

const GameAccountsContext = createContext<GameAccountsContextValue | null>(null)

const statusOf = (err: unknown) => (err as Error & { status?: number }).status

/** The user's game accounts, shared by every page that lists or edits them. */
export function GameAccountsProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { t } = useI18n()
  const { status } = useSession()
  const { refreshRoles } = useAllianceContext()
  const [accounts, setAccounts] = useState<GameAccount[]>([])
  const [deletedAccounts, setDeletedAccounts] = useState<DeletedGameAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setAccounts([])
      setDeletedAccounts([])
      setLoading(status === 'loading')
      return
    }
    try {
      const [data, deletedData] = await Promise.all([
        getMyGameAccounts(),
        getDeletedGameAccounts().catch(() => [] as DeletedGameAccount[]),
      ])
      setAccounts(data)
      setDeletedAccounts(deletedData)
      setLoadError(false)
    } catch (err) {
      console.error(err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const applyAccount = (account: GameAccount) =>
    setAccounts((prev) =>
      prev.some((a) => a.id === account.id)
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account]
    )

  // Any write can move the primary flag, a restore slot or an alliance role, so the
  // returned account is applied at once and the lists are then reloaded from the API.
  const reload = () => Promise.all([refresh(), refreshRoles()])

  const create = async (pseudo: string) => {
    try {
      applyAccount(await createGameAccount(pseudo, accounts.length === 0))
      toast.success(t.game.accounts.createSuccess)
      await reload()
      return true
    } catch (err) {
      console.error(err)
      toast.error(t.game.accounts.createError)
      return false
    }
  }

  const update = async (account: GameAccount, pseudo: string, isPrimary: boolean) => {
    try {
      applyAccount(await updateGameAccount(account.id, pseudo, isPrimary))
      toast.success(
        isPrimary && !account.is_primary
          ? (t.game.accounts.primarySet ?? 'Primary account updated')
          : t.game.accounts.editSuccess
      )
      await reload()
      return true
    } catch (err) {
      console.error(err)
      toast.error(t.game.accounts.editError)
      return false
    }
  }

  const remove = async (account: GameAccount) => {
    try {
      await deleteGameAccount(account.id)
      toast.success(t.game.accounts.deleteSuccess)
      await reload()
      return true
    } catch (err) {
      console.error(err)
      // 409 is the backend refusing to delete an account still tied to an alliance.
      toast.error(
        statusOf(err) === 409 ? t.game.accounts.deleteInAlliance : t.game.accounts.deleteError
      )
      return false
    }
  }

  const restore = async (account: DeletedGameAccount) => {
    try {
      applyAccount(await restoreGameAccount(account.id))
      toast.success(t.game.accounts.restoreSuccess)
    } catch (err) {
      console.error(err)
      // 410 means the restore window closed while the page was open.
      toast.error(
        statusOf(err) === 410 ? t.game.accounts.restoreExpired : t.game.accounts.restoreError
      )
    }
    await reload()
  }

  const value = useMemo<GameAccountsContextValue>(
    () => ({
      accounts,
      deletedAccounts,
      loading,
      loadError,
      refresh,
      create,
      update,
      remove,
      restore,
    }),
    // oxlint-disable-next-line react/exhaustive-deps
    [accounts, deletedAccounts, loading, loadError, refresh, refreshRoles, t]
  )

  return <GameAccountsContext.Provider value={value}>{children}</GameAccountsContext.Provider>
}

export function useGameAccounts(): GameAccountsContextValue {
  const ctx = useContext(GameAccountsContext)
  if (!ctx) throw new Error('useGameAccounts must be used inside <GameAccountsProvider>')
  return ctx
}
