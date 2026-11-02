import { useCallback, useRef, useState } from 'react'

// Gates the screenshot file picker behind a how-to dialog shown on every import.
export function useVisionImportHowto() {
  const [open, setOpen] = useState(false)
  // Held in a ref, not state: storing the pending action must not re-render,
  // and confirm() must see the value set by the click that opened the dialog.
  const proceedRef = useRef<(() => void) | null>(null)

  const request = useCallback((onProceed: () => void) => {
    proceedRef.current = onProceed
    setOpen(true)
  }, [])

  const confirm = useCallback(() => {
    setOpen(false)
    const proceed = proceedRef.current
    proceedRef.current = null
    proceed?.()
  }, [])

  return { open, setOpen, request, confirm }
}
