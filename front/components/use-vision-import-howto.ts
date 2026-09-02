import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'mawster.vision.howtoHidden'

function loadHidden(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage unavailable (private browsing) — show the dialog.
    return false
  }
}

function storeHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(STORAGE_KEY, '1')
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // The preference simply does not survive the session.
  }
}

// Gates the screenshot file picker behind a how-to dialog the user can opt out
// of. The opt-out is per browser, not per game account: the procedure is the
// same everywhere. It is loaded on mount rather than in the useState
// initializer — 'use client' still runs through Next's server prerender, where
// localStorage does not exist.
export function useVisionImportHowto() {
  const [open, setOpen] = useState(false)
  const [dontShow, setDontShow] = useState(false)
  // Held in a ref, not state: storing the pending action must not re-render,
  // and confirm() must see the value set by the click that opened the dialog.
  const proceedRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setDontShow(loadHidden())
  }, [])

  // Exposed as setDontShow: callers must not be able to flip the flag without
  // persisting it, so the raw state setter stays inside the hook.
  const setDontShowAndStore = useCallback((value: boolean) => {
    setDontShow(value)
    storeHidden(value)
  }, [])

  const request = useCallback(
    (onProceed: () => void) => {
      if (dontShow) {
        onProceed()
        return
      }
      proceedRef.current = onProceed
      setOpen(true)
    },
    [dontShow]
  )

  // The help icon informs; it must never start an import.
  const reopen = useCallback(() => {
    proceedRef.current = null
    setOpen(true)
  }, [])

  const confirm = useCallback(() => {
    setOpen(false)
    const proceed = proceedRef.current
    proceedRef.current = null
    proceed?.()
  }, [])

  return {
    open,
    setOpen,
    request,
    reopen,
    dontShow,
    setDontShow: setDontShowAndStore,
    confirm,
  }
}
