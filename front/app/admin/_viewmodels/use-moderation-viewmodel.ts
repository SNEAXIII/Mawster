'use client'

import { useCallback, useEffect, useState } from 'react'
import { withToast } from '@/app/lib/with-toast'
import { useI18n } from '@/app/i18n'
import {
  type Mute,
  type NoteReport,
  type NoteRevision,
  type Warn,
  getRevisions,
  liftMute,
  listMutes,
  listReports,
  listWarns,
  muteUser,
  resolveReport,
  warnUser,
} from '@/app/services/moderation'
import type { ModerationKind } from '../_components/user-moderation-dialog'

export function useModerationViewModel() {
  const { t } = useI18n()
  const m = t.moderation
  const [reports, setReports] = useState<NoteReport[]>([])
  const [status, setStatus] = useState<string>('pending')
  const [mutes, setMutes] = useState<Mute[]>([])
  const [warns, setWarns] = useState<Warn[]>([])
  const [revisions, setRevisions] = useState<NoteRevision[]>([])
  const [revisionsLoading, setRevisionsLoading] = useState(false)

  const loadReports = useCallback(async () => {
    await withToast(() => listReports(status === 'all' ? undefined : status), {
      error: m.loadError,
      onSuccess: (res) => setReports(res.items),
    })
  }, [status, m.loadError])

  const loadSanctions = useCallback(async () => {
    await withToast(() => Promise.all([listMutes(true), listWarns()]), {
      error: m.loadError,
      onSuccess: ([mu, wa]) => {
        setMutes(mu)
        setWarns(wa)
      },
    })
  }, [m.loadError])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    void loadSanctions()
  }, [loadSanctions])

  const resolve = async (id: string, action: 'delete' | 'dismiss') => {
    await withToast(() => resolveReport(id, action), {
      success: m.resolveSuccess,
      error: m.resolveError,
      onSuccess: loadReports,
    })
  }

  const sanction = async (
    kind: ModerationKind,
    userId: string,
    reason: string,
    expiresAt: string | null
  ) => {
    const isMute = kind === 'mute'
    await withToast(
      () => (isMute ? muteUser(userId, reason, expiresAt) : warnUser(userId, reason)),
      {
        success: isMute ? m.muteSuccess : m.warnSuccess,
        error: isMute ? m.muteError : m.warnError,
        onSuccess: loadSanctions,
      }
    )
  }

  const lift = async (userId: string) => {
    await withToast(() => liftMute(userId), {
      success: m.liftSuccess,
      error: m.liftError,
      onSuccess: loadSanctions,
    })
  }

  const loadRevisions = useCallback(async (noteId: string) => {
    setRevisionsLoading(true)
    try {
      setRevisions(await getRevisions(noteId))
    } catch {
      setRevisions([])
    } finally {
      setRevisionsLoading(false)
    }
  }, [])

  return {
    reports,
    status,
    setStatus,
    resolve,
    mutes,
    warns,
    loadSanctions,
    sanction,
    lift,
    revisions,
    revisionsLoading,
    loadRevisions,
  }
}

export type ModerationViewModel = ReturnType<typeof useModerationViewModel>
