import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'mawster.vision.singleScreenWarningDismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistDismissal() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable (private browsing): the warning simply shows again next time.
  }
}

// Holds a single-screenshot upload until the Player confirms it, since one
// screenshot only covers two rows of a roster.
export function useVisionSingleScreenWarning({ onAddMore }: { onAddMore: () => void }) {
  const [open, setOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const uploadRef = useRef<(() => void) | null>(null)

  const gate = useCallback((files: File[], upload: () => void) => {
    if (files.length !== 1 || isDismissed()) {
      upload()
      return
    }
    uploadRef.current = upload
    setDontShowAgain(false)
    setOpen(true)
  }, [])

  const confirm = () => {
    if (dontShowAgain) persistDismissal()
    const upload = uploadRef.current
    uploadRef.current = null
    upload?.()
  }

  const addMore = () => {
    uploadRef.current = null
    onAddMore()
  }

  return { open, setOpen, dontShowAgain, setDontShowAgain, gate, confirm, addMore }
}
