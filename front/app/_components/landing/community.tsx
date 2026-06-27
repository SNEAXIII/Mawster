'use client';

import { FaGithub, FaDiscord } from 'react-icons/fa6';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LANDING_LINKS } from './links';

export function Community() {
  const { t } = useI18n();

  return (
    <section className='px-6 py-20 md:px-12'>
      <Card className='mx-auto max-w-4xl'>
        <CardContent className='p-8 text-center md:p-12'>
          <p className='text-sm font-medium uppercase tracking-wider text-brand'>
            {t.landing.openSourceEyebrow}
          </p>
          <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{t.landing.openSourceTitle}</h2>
          <p className='mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground'>
            {t.landing.openSourceDesc}
          </p>

          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button
              asChild
              variant='outline'
            >
              <a
                href={LANDING_LINKS.repo}
                target='_blank'
                rel='noopener noreferrer'
                data-cy='community-repo'
              >
                <FaGithub className='h-4 w-4' />
                {t.landing.linkRepo}
              </a>
            </Button>
            <Button asChild>
              <a
                href={LANDING_LINKS.discordSupport}
                target='_blank'
                rel='noopener noreferrer'
                data-cy='community-discord'
              >
                <FaDiscord className='h-4 w-4' />
                {t.landing.linkSupport}
              </a>
            </Button>
          </div>

          <p className='mt-6 text-xs uppercase tracking-wider text-muted-foreground'>
            {t.landing.contactLabel} ·{' '}
            <span className='text-foreground'>{LANDING_LINKS.discordHandle}</span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
