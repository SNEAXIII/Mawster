'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
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
    try {
      const res = await listReports(status === 'all' ? undefined : status)
      setReports(res.items)
    } catch (err) {
      toast.error((err as Error).message || m.loadError)
    }
  }, [status, m.loadError])

  const loadSanctions = useCallback(async () => {
    try {
      const [mu, wa] = await Promise.all([listMutes(true), listWarns()])
      setMutes(mu)
      setWarns(wa)
    } catch (err) {
      toast.error((err as Error).message || m.loadError)
    }
  }, [m.loadError])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    void loadSanctions()
  }, [loadSanctions])

  const resolve = async (id: string, action: 'delete' | 'dismiss') => {
    try {
      await resolveReport(id, action)
      toast.success(m.resolveSuccess)
      await loadReports()
    } catch (err) {
      toast.error((err as Error).message || m.resolveError)
    }
  }

  const sanction = async (
    kind: ModerationKind,
    userId: string,
    reason: string,
    expiresAt: string | null
  ) => {
    try {
      if (kind === 'mute') {
        await muteUser(userId, reason, expiresAt)
        toast.success(m.muteSuccess)
      } else {
        await warnUser(userId, reason)
        toast.success(m.warnSuccess)
      }
      await loadSanctions()
    } catch (err) {
      toast.error((err as Error).message || (kind === 'mute' ? m.muteError : m.warnError))
    }
  }

  const lift = async (userId: string) => {
    try {
      await liftMute(userId)
      toast.success(m.liftSuccess)
      await loadSanctions()
    } catch (err) {
      toast.error((err as Error).message || m.liftError)
    }
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
