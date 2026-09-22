'use client'

import Link from 'next/link'
import { FaDiscord, FaGoogle } from 'react-icons/fa6'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'

export function Cta() {
  const { t } = useI18n()

  return (
    <section className='px-6 py-24 md:px-12'>
      <div className='mx-auto max-w-2xl text-center'>
        <h2 className='text-3xl font-bold sm:text-4xl'>{t.landing.ctaTitle}</h2>
        <p className='mt-4 text-muted-foreground'>{t.landing.ctaSubtitle}</p>

        <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
          <Button
            asChild
            size='lg'
          >
            <Link
              href='/login'
              data-cy='cta-discord'
            >
              <FaDiscord className='h-4 w-4' />
              {t.landing.ctaDiscord}
            </Link>
          </Button>
          <Button
            asChild
            variant='outline'
            size='lg'
          >
            <Link
              href='/login'
              data-cy='cta-google'
            >
              <FaGoogle className='h-4 w-4' />
              {t.landing.ctaGoogle}
            </Link>
          </Button>
        </div>

        <p className='mt-5 text-xs uppercase tracking-wider text-muted-foreground'>
          {t.landing.ctaSoon}
        </p>
      </div>
    </section>
  )
}
