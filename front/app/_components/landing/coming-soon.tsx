'use client'

import { Bot, ScanLine } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SoonBadge() {
  const { t } = useI18n()
  return (
    <Badge
      variant='outline'
      className='bg-orange-500'
    >
      {t.landing.soonBadge}
    </Badge>
  )
}

export function InDevBadge() {
  const { t } = useI18n()
  return (
    <Badge
      variant='outline'
      className='bg-green-700'
    >
      {t.landing.inDevBadge}
    </Badge>
  )
}

export function ComingSoon() {
  const { t } = useI18n()

  const features = [
    {
      icon: ScanLine,
      title: t.landing.soonScanTitle,
      desc: t.landing.soonScanDesc,
      badge: InDevBadge,
    },
    { icon: Bot, title: t.landing.soonBotTitle, desc: t.landing.soonBotDesc, badge: SoonBadge },
  ]

  return (
    <section
      className='px-6 py-12 md:px-12'
      data-cy='landing-coming-soon'
    >
      <div className='mx-auto max-w-6xl'>
        <h2 className='text-3xl font-bold sm:text-4xl'>{t.landing.soonTitle}</h2>

        <div className='mt-10 grid gap-4 sm:grid-cols-2'>
          {features.map((feature) => {
            const Icon = feature.icon
            const Badge = feature.badge
            return (
              <Card
                key={feature.title}
                className='border-dashed bg-muted/20'
              >
                <CardContent className='pt-6'>
                  <div className='flex items-center justify-between'>
                    <span className='flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
                      <Icon className='h-5 w-5' />
                    </span>
                    <Badge />
                  </div>
                  <h3 className='mt-5 text-lg font-semibold'>{feature.title}</h3>
                  <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
