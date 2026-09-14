'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { useSeasonContext } from '@/app/contexts/season-context'
import {
  closeSeason,
  createSeason,
  listSeasons,
  openSeason,
  revertSeason,
  type Season,
  type SeasonFormat,
} from '@/app/services/season'

export type SeasonAction = 'open' | 'close' | 'revert'

const SEASON_ACTION_CALLS: Record<SeasonAction, (id: string) => Promise<Season>> = {
  open: openSeason,
  close: closeSeason,
  revert: revertSeason,
}

export function useSeasonsViewModel() {
  const { t } = useI18n()
  const { refresh: refreshCurrentSeason } = useSeasonContext()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSeasons(await listSeasons())
    } catch {
      setError(t.game.season.admin.createError)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const create = async (number: number, format: SeasonFormat) => {
    try {
      await createSeason(number, format)
      await load()
      return true
    } catch {
      setError(t.game.season.admin.createError)
      return false
    }
  }

  // One transition can move another season too, so the list is reloaded rather than patched.
  const runAction = async (id: string, action: SeasonAction) => {
    const errors: Record<SeasonAction, string> = {
      open: t.game.season.admin.openError,
      close: t.game.season.admin.closeError,
      revert: t.game.season.admin.revertError,
    }
    try {
      await SEASON_ACTION_CALLS[action](id)
      await Promise.all([load(), refreshCurrentSeason()])
    } catch {
      setError(errors[action])
    }
  }

  return { seasons, error, create, runAction }
}
