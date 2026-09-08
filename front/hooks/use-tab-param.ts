'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface TabParamOptions<T extends string> {
  /**
   * Query params to drop when the tab becomes `tab`.
   *
   * A tab that carries its own state in the URL leaves it behind on the way out
   * — the alliances page writes `alliance` and `bg` while its Defense tab is
   * open, and those mean nothing anywhere else. Returning them here is what
   * keeps a stale pair from surviving a reload on another tab.
   */
  clearParams?: (tab: T) => readonly string[]
}

/**
 * A tab selection kept in the URL, so a tab can be linked to and survives a
 * reload or a back button.
 *
 * `replace`, never `push`: switching tabs is not a navigation anyone wants to
 * walk back through one by one. The first render is skipped so landing on a
 * bare URL does not immediately rewrite it.
 */
export function useTabParam<T extends string>(
  values: readonly T[],
  defaultTab: T,
  options: TabParamOptions<T> = {}
): [T, (tab: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const requested = searchParams.get('tab') as T | null
  const [activeTab, setActiveTab] = useState<T>(
    requested && values.includes(requested) ? requested : defaultTab
  )

  // Read through a ref: callers pass an inline arrow, which would be a new
  // function on every render and is not a reason to rewrite the URL.
  const clearParamsRef = useRef(options.clearParams)
  clearParamsRef.current = options.clearParams

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    for (const key of clearParamsRef.current?.(activeTab) ?? []) {
      params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // Only the tab drives this — re-running on a searchParams change would
    // fight whatever else writes to the query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return [activeTab, setActiveTab]
}
