import { useCallback, useState } from 'react'
import {
  getCurrentVisionImport,
  cancelVisionImport,
  type CurrentVisionImport,
} from '@/app/services/vision'

export interface UseVisionImportGuardProps {
  selectedAccountId: string
  resume: (importId: string) => void | Promise<void>
  onOpenFilePicker: () => void
}

// Guards the "Import IA" button: a click that would 409 (an import is
// already actionable on this account) instead offers to resume or discard
// it, so the user never picks screenshots only to be rejected afterwards.
// The server keeps its own 409 — this is UX, not the source of truth (two
// tabs can still race it).
export function useVisionImportGuard({
  selectedAccountId,
  resume,
  onOpenFilePicker,
}: UseVisionImportGuardProps) {
  const [blockedImport, setBlockedImport] = useState<CurrentVisionImport | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const guardedOpen = useCallback(async () => {
    const blocking = await getCurrentVisionImport(selectedAccountId)
    if (blocking == null) {
      onOpenFilePicker()
      return
    }
    setBlockedImport(blocking)
    setDialogOpen(true)
  }, [selectedAccountId, onOpenFilePicker])

  const resumeBlocked = useCallback(() => {
    if (blockedImport == null) return
    void resume(blockedImport.id)
  }, [blockedImport, resume])

  const discardBlocked = useCallback(() => {
    if (blockedImport == null) return
    void cancelVisionImport(blockedImport.id).then(onOpenFilePicker)
  }, [blockedImport, onOpenFilePicker])

  return { dialogOpen, setDialogOpen, guardedOpen, resumeBlocked, discardBlocked }
}
