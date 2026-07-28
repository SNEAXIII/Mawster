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
  // Called after a successful discard instead of onOpenFilePicker. Must open
  // the picker directly (no how-to): the blocked dialog is still animating
  // out at that point, and routing through another AlertDialog there risks
  // stacking two Radix dialogs mid-transition (stuck `pointer-events: none`
  // on body). The user also just confirmed "discard and start over" — they
  // do not need the procedure re-explained.
  onDiscardFilePicker: () => void
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
  onDiscardFilePicker,
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
    void cancelVisionImport(blockedImport.id).then(onDiscardFilePicker)
  }, [blockedImport, onDiscardFilePicker])

  return { dialogOpen, setDialogOpen, guardedOpen, resumeBlocked, discardBlocked }
}
