'use client'

import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Card } from '@/components/ui/card'

export function Faq() {
  const { t } = useI18n()

  return (
    <section
      className='px-6 py-12 md:px-12'
      data-cy='landing-faq'
    >
      <div className='mx-auto max-w-3xl'>
        <p className='text-sm font-medium uppercase tracking-wider text-brand'>
          {t.landing.faqEyebrow}
        </p>
        <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{t.landing.faqTitle}</h2>

        <div className='mt-10 space-y-3'>
          {t.landing.faqItems.map((item) => (
            <Card
              key={item.q}
              className='overflow-hidden'
            >
              <details className='group'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium'>
                  {item.q}
                  <ChevronDown className='h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180' />
                </summary>
                <p className='px-5 pb-5 leading-relaxed text-muted-foreground'>{item.a}</p>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
