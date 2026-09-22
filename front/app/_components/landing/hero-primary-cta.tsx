'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStatus } from '@/hooks/use-auth-status'

export function HeroPrimaryCta() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading } = useAuthStatus()

  if (isLoading) return <Skeleton className='h-10 w-48' />

  const { href, label, dataCy } = isAuthenticated
    ? { href: '/game/account', label: t.landing.heroCtaApp, dataCy: 'hero-cta-app' }
    : { href: '/login', label: t.landing.heroCtaPrimary, dataCy: 'hero-cta-primary' }

  return (
    <Button
      asChild
      size='lg'
    >
      <Link
        href={href}
        data-cy={dataCy}
      >
        {label}
        <ArrowRight className='h-4 w-4' />
      </Link>
    </Button>
  )
}
