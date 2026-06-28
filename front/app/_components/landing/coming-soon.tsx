'use client';

import { Bot, ScanLine } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoon() {
  const { t } = useI18n();

  const items = [
    { icon: Bot, title: t.landing.soonBotTitle, desc: t.landing.soonBotDesc },
    { icon: ScanLine, title: t.landing.soonScanTitle, desc: t.landing.soonScanDesc },
  ];

  return (
    <section
      className='px-6 py-12 md:px-12'
      data-cy='landing-coming-soon'
    >
      <div className='mx-auto max-w-5xl'>
        <h2 className='text-3xl font-bold sm:text-4xl'>{t.landing.soonTitle}</h2>

        <div className='mt-10 grid gap-4 sm:grid-cols-2'>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className='border-dashed bg-muted/20'
              >
                <CardContent className='pt-6'>
                  <div className='flex items-center justify-between'>
                    <span className='flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
                      <Icon className='h-5 w-5' />
                    </span>
                    <span className='rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                      {t.landing.soonBadge}
                    </span>
                  </div>
                  <h3 className='mt-5 text-lg font-semibold'>{item.title}</h3>
                  <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{item.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
