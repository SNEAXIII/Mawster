'use client'

import { useCallback, useState, type RefObject } from 'react'
import { downloadElementAsJpg } from '@/app/lib/export-image'

/**
 * Drives a "capture this element as an image" button.
 *
 * The flag has to be in the DOM *before* the capture: the tree renders its
 * export-only look while it is on (black background, no action buttons, columns
 * that make no sense on an image dropped, full-resolution portraits through
 * `ExportModeProvider`). Hence the two `requestAnimationFrame`s — one to let
 * React commit the state change, one to let the browser paint it.
 */
export function useImageExport() {
  const [exporting, setExporting] = useState(false)

  const exportImage = useCallback(
    async (ref: RefObject<HTMLElement | null>, filename: string): Promise<void> => {
      if (!ref.current) return
      setExporting(true)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
      try {
        if (!ref.current) return
        await downloadElementAsJpg(ref.current, filename)
      } finally {
        setExporting(false)
      }
    },
    []
  )

  return { exporting, exportImage }
}

/** `knowledge-base-2026-08-23.jpg` — same shape as the war/defense exports. */
export function exportFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.jpg`
}
