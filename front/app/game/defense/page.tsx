'use client'

import { Suspense, useCallback } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { AllianceRoleProvider } from '@/hooks/use-alliance-role'
import { PageContainer } from '@/components/page-container'
import DefensePageContent from './_components/defense-content'

function DefensePageInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialAllianceId = searchParams.get('alliance') ?? undefined
  const initialBg = searchParams.get('bg') ? Number(searchParams.get('bg')) : undefined

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
      <PageContainer>
        <DefensePageContent
          onStateChange={handleStateChange}
          initialAllianceId={initialAllianceId}
          initialBg={initialBg}
        />
      </PageContainer>
    </AllianceRoleProvider>
  )
}

export default function DefensePage() {
  return (
    <Suspense>
      <DefensePageInner />
    </Suspense>
  )
}
