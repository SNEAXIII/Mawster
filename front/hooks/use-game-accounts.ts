'use client'

import { useEffect, useState } from 'react'
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

const statusOf = (err: unknown) => (err as Error & { status?: number }).status

export function useGameAccounts(onAccountsChange?: () => void) {
  const { t } = useI18n()
  const { refreshRoles } = useAllianceContext()
  const [accounts, setAccounts] = useState<GameAccount[]>([])
  const [deletedAccounts, setDeletedAccounts] = useState<DeletedGameAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAccounts = async () => {
    try {
      const [data, deletedData] = await Promise.all([
        getMyGameAccounts(),
        getDeletedGameAccounts().catch(() => [] as DeletedGameAccount[]),
      ])
      setAccounts(data)
      setDeletedAccounts(deletedData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  // Creating, deleting or restoring an account can change its alliance role.
  const reload = async () => {
    await Promise.all([fetchAccounts(), refreshRoles()])
    onAccountsChange?.()
  }

  const applyAccount = (account: GameAccount) =>
    setAccounts((prev) =>
      prev.some((a) => a.id === account.id)
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account]
    )

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

  // Setting a primary account flips the previous one, so the list is reloaded as well.
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

  return { accounts, deletedAccounts, loading, create, remove, restore, update }
}
