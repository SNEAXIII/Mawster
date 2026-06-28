'use client';

import {
  BarChart3,
  ScrollText,
  Shield,
  Lock,
  Timer,
  ShieldCheck,
  MessagesSquare,
} from 'lucide-react';
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
    { icon: Shield, title: t.landing.featWarTitle, desc: t.landing.featWarDesc },
    { icon: Timer, title: t.landing.featOnboardingTitle, desc: t.landing.featOnboardingDesc },
  ];

  return (
    <section
      id='features'
      className='px-6 py-12 md:px-12'
    >
      <div className='mx-auto max-w-6xl'>
        <h2 className='text-3xl font-bold sm:text-4xl'>{t.landing.featuresEyebrow}</h2>

        <div className='mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.title}
                className={`transition hover:border-brand/40${f.isNew ? ' border-brand/40' : ''}`}
              >
                <CardContent className='pt-6'>
                  <div className='flex items-center gap-3'>
                    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand'>
                      <Icon className='h-5 w-5' />
                    </span>
                    <h3 className='min-w-0 text-lg font-semibold'>{f.title}</h3>
                    {f.isNew && (
                      <span className='ml-auto shrink-0 rounded-md bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand'>
                        {t.landing.featNew}
                      </span>
                    )}
                  </div>
                  <p className='mt-3 text-sm leading-relaxed text-muted-foreground'>{f.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
