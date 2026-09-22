'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'

export function SignedInHome({ userName }: Readonly<{ userName: string | null }>) {
  const { t } = useI18n()
  return (
    <section
      className='flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center'
      data-cy='home-signed-in'
    >
      <h1 className='text-3xl font-bold tracking-tight'>
        {userName
          ? t.landing.signedInTitle.replace('{name}', userName)
          : t.landing.signedInTitleAnonymous}
      </h1>
      <p className='text-muted-foreground'>{t.landing.signedInSubtitle}</p>
      <Button
        asChild
        size='lg'
      >
        <Link
          href='/game/account'
          data-cy='home-signed-in-cta'
        >
          {t.landing.signedInCta}
          <ArrowRight className='h-4 w-4' />
        </Link>
      </Button>
    </section>
  )
}
