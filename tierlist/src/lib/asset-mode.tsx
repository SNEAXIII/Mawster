import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { STATIC_ORIGIN } from './assets'

/** Cheap, already-needed asset used to probe the static host's CORS headers. */
const PROBE_URL = `${STATIC_ORIGIN}/static/frame/7_stars.png?cors-probe=1`

const AnonymousImagesContext = createContext(true)

/**
 * True when the static host answers with `Access-Control-Allow-Origin`, i.e.
 * when portraits can be requested in CORS mode.
 *
 * This matters because the two things the app needs pull in opposite
 * directions: a PNG export can only read images fetched with
 * `crossOrigin="anonymous"` (anything else taints the canvas), but requesting
 * that from a host which does *not* send the header makes the image fail to
 * load outright. So probe once and let every portrait follow the answer —
 * artwork always shows, and the export works wherever CORS allows it.
 */
export function useAnonymousImages(): boolean {
  return useContext(AnonymousImagesContext)
}

export function AnonymousImagesProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [anonymous, setAnonymous] = useState(true)

  useEffect(() => {
    const probe = new Image()
    probe.crossOrigin = 'anonymous'
    probe.onerror = () => setAnonymous(false)
    probe.src = PROBE_URL
    return () => {
      probe.onerror = null
    }
  }, [])

  return (
    <AnonymousImagesContext.Provider value={anonymous}>{children}</AnonymousImagesContext.Provider>
  )
}
