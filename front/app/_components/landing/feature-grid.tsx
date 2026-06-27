'use client';

import { BarChart3, ScrollText, Crosshair, ShieldHalf, Lock, Timer, ShieldCheck, MessagesSquare } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Card, CardContent } from '@/components/ui/card';

export function FeatureGrid() {
  const { t } = useI18n();

  const features = [
    {
      icon: MessagesSquare,
      title: t.landing.featNotesTitle,
      desc: t.landing.featNotesDesc,
      isNew: true,
    },
    { icon: ShieldCheck, title: t.landing.featPrivacyTitle, desc: t.landing.featPrivacyDesc },
    { icon: BarChart3, title: t.landing.featStatsTitle, desc: t.landing.featStatsDesc },
    { icon: ScrollText, title: t.landing.featHistoryTitle, desc: t.landing.featHistoryDesc },
    { icon: Crosshair, title: t.landing.featAttackTitle, desc: t.landing.featAttackDesc },
    { icon: ShieldHalf, title: t.landing.featDefenseTitle, desc: t.landing.featDefenseDesc },
    { icon: Timer, title: t.landing.featOnboardingTitle, desc: t.landing.featOnboardingDesc },
  ];

  return (
    <section
      id='features'
      className='px-6 py-20 md:px-12'
    >
      <div className='mx-auto max-w-6xl'>
        <p className='text-sm font-medium uppercase tracking-wider text-brand'>
          {t.landing.featuresEyebrow}
        </p>
        <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{t.landing.featuresTitle}</h2>

        <Card className='mt-10 border-brand/30 bg-brand/5'>
          <CardContent className='flex items-start gap-5 pt-6'>
            <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand'>
              <Lock className='h-6 w-6' />
            </span>
            <div>
              <h3 className='text-2xl font-bold'>{t.landing.featLockTitle}</h3>
              <p className='mt-3 max-w-2xl leading-relaxed text-muted-foreground'>
                {t.landing.featLockDesc}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className='mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.title}
                className={`transition hover:border-brand/40${f.isNew ? ' border-brand/40' : ''}`}
              >
                <CardContent className='pt-6'>
                  <div className='flex items-center justify-between'>
                    <span className='flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand'>
                      <Icon className='h-5 w-5' />
                    </span>
                    {f.isNew && (
                      <span className='rounded-md bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand'>
                        {t.landing.featNew}
                      </span>
                    )}
                  </div>
                  <h3 className='mt-5 text-lg font-semibold'>{f.title}</h3>
                  <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{f.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
