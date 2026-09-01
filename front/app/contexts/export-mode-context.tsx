'use client'

import { createContext, useContext } from 'react'

/**
 * True while a screen (war / defense map or list) is being captured as a PNG.
 * Components rendered inside an export tree use it to swap their pre-resized
 * thumbnails for the full-resolution assets, so the capture stays sharp once
 * snapdom upscales it (see `app/lib/export-image.ts`).
 */
const ExportModeContext = createContext(false)

export const ExportModeProvider = ExportModeContext.Provider

export function useExportMode(): boolean {
  return useContext(ExportModeContext)
}
