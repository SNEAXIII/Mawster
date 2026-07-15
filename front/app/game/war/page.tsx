'use client'

import { Suspense, useCallback } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { AllianceRoleProvider } from '@/hooks/use-alliance-role'
import WarContent from './_components/war-content'

function WarPageInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialAllianceId = searchParams.get('alliance') ?? undefined
  const bgParam = searchParams.get('bg')
  const parsedBg = bgParam ? Number(bgParam) : undefined
  const initialBg = parsedBg && [1, 2, 3].includes(parsedBg) ? parsedBg : undefined

  const handleStateChange = useCallback(
    (allianceId: string, bg: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('alliance', allianceId)
      params.set('bg', String(bg))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, searchParams, router]
  )

  return (
    <AllianceRoleProvider>
      <WarContent
        onStateChange={handleStateChange}
        initialAllianceId={initialAllianceId}
        initialBg={initialBg}
      />
    </AllianceRoleProvider>
  )
}

export default function WarPage() {
  return (
    <Suspense>
      <WarPageInner />
    </Suspense>
  )
}
