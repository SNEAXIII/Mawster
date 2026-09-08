'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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
  defaultTab: T
): [T, (tab: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const requested = searchParams.get('tab') as T | null
  const [activeTab, setActiveTab] = useState<T>(
    requested && values.includes(requested) ? requested : defaultTab
  )

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // Only the tab drives this — re-running on a searchParams change would
    // fight whatever else writes to the query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return [activeTab, setActiveTab]
}
