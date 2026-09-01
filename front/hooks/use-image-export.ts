'use client'

import { useCallback, useState, type RefObject } from 'react'
import { downloadElementAsPng } from '@/app/lib/export-image'

/**
 * Drives a "capture this element as a PNG" button.
 *
 * The flag has to be in the DOM *before* the capture: the tree renders its
 * export-only look while it is on (black background, no action buttons, columns
 * that make no sense on an image dropped, full-resolution portraits through
 * `ExportModeProvider`). Hence the two `requestAnimationFrame`s — one to let
 * React commit the state change, one to let the browser paint it.
 */
export function useImageExport() {
  const [exporting, setExporting] = useState(false)

  const exportPng = useCallback(
    async (ref: RefObject<HTMLElement | null>, filename: string): Promise<void> => {
      if (!ref.current) return
      setExporting(true)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
      try {
        if (!ref.current) return
        await downloadElementAsPng(ref.current, filename)
      } finally {
        setExporting(false)
      }
    },
    []
  )

  return { exporting, exportPng }
}

/** `knowledge-base-2026-08-23.png` — same shape as the war/defense exports. */
export function exportFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.png`
}
