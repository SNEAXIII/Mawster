'use client'

import { useCallback, useEffect, useState } from 'react'
import { withToast } from '@/app/lib/with-toast'
import { useI18n } from '@/app/i18n'
import {
  type AdminAscensionRequest,
  acceptAscensionRequest,
  getAdminAscensionRequests,
  refuseAscensionRequest,
} from '@/app/services/ascension-requests'

export function useAdminAscensionRequests() {
  const { t } = useI18n()
  const { acceptError, refuseError } = t.champions.ascensionRequest
  const [requests, setRequests] = useState<AdminAscensionRequest[]>([])

  const reload = useCallback(async () => {
    try {
      setRequests(await getAdminAscensionRequests())
    } catch {
      // Silent: runs in the background on every admin tab, a failure only leaves the counter stale.
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Reloads on failure too: a 404 means another Admin handled it, and the row must clear.
  const settle = async (call: () => Promise<void>, error: string) => {
    await withToast(call, { error })
    await reload()
  }

  const accept = (id: string) => settle(() => acceptAscensionRequest(id), acceptError)
  const refuse = (id: string) => settle(() => refuseAscensionRequest(id), refuseError)

  return { requests, reload, accept, refuse }
}

export type AdminAscensionRequests = ReturnType<typeof useAdminAscensionRequests>
