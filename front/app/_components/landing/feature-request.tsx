'use client';

import { MessageSquarePlus, Users, Hammer, Crown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LANDING_LINKS } from './links';

export function FeatureRequest() {
  const { t } = useI18n();

  const steps = [
    { icon: MessageSquarePlus, label: t.landing.requestStep1 },
    { icon: Users, label: t.landing.requestStep2 },
    { icon: Hammer, label: t.landing.requestStep3 },
  ];

  return (
    <section
      className='px-6 py-12 md:px-12'
      data-cy='landing-feature-request'
    >
      <div className='mx-auto max-w-5xl'>
        <h2 className='text-3xl font-bold sm:text-4xl'>{t.landing.requestTitle}</h2>
        <p className='mt-4 max-w-2xl leading-relaxed text-muted-foreground'>
          {t.landing.requestDesc}
        </p>

        <ol className='mt-10 grid gap-6 sm:grid-cols-3'>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className='flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-5'
              >
                <span className='relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand'>
                  <Icon className='h-5 w-5' />
                  <span className='absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white'>
                    {i + 1}
                  </span>
                </span>
                <p className='text-sm font-medium leading-relaxed'>{step.label}</p>
              </li>
            );
          })}
        </ol>

        <Card className='mt-6 border-amber-400/30 bg-amber-400/5'>
          <CardContent className='flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-start gap-4'>
              <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-500'>
                <Crown className='h-5 w-5' />
              </span>
              <div>
                <h3 className='text-lg font-semibold'>{t.landing.requestPremiumTitle}</h3>
                <p className='mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground'>
                  {t.landing.requestPremiumDesc}
                </p>
              </div>
            </div>
            <Button asChild>
              <a
                href={LANDING_LINKS.discordSupport}
                target='_blank'
                rel='noopener noreferrer'
                data-cy='feature-request-cta'
              >
                <MessageSquarePlus className='h-4 w-4' />
                {t.landing.requestCta}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
