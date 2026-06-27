'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AllianceRankingChart from '@/app/game/alliances/_components/alliance-ranking-chart';
import { MOCK_RANKING_POINTS, MOCK_RANKING_SEASON } from './stats-mock-data';

export function Hero() {
  const { t } = useI18n();

  return (
    <section className='grid items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:gap-10 md:px-12 md:pt-24'>
      <div>
        <span className='inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand'>
          <span className='h-1.5 w-1.5 rounded-full bg-brand' />
          {t.landing.eyebrow}
        </span>

        <h1 className='mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl'>
          {t.landing.heroTitle}
        </h1>

        <p className='mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg'>
          {t.landing.heroSubtitle}
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <Button
            asChild
            size='lg'
          >
            <Link href='/login' data-cy='hero-cta-primary'>
              {t.landing.heroCtaPrimary}
              <ArrowRight className='h-4 w-4' />
            </Link>
          </Button>
          <Button
            asChild
            variant='outline'
            size='lg'
          >
            <a href='#features' data-cy='hero-cta-secondary'>{t.landing.heroCtaSecondary}</a>
          </Button>
        </div>

        <p className='mt-5 text-xs uppercase tracking-wider text-muted-foreground'>
          {t.landing.heroNote}
        </p>
      </div>

      <div className='hidden md:block'>
        <Card className='select-none shadow-lg'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm'>{t.landing.statsShowcase.rankingTitle}</CardTitle>
            <span className='rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500'>
              {t.landing.statsShowcase.demoBadge}
            </span>
          </CardHeader>
          <CardContent className='pointer-events-none'>
            <AllianceRankingChart
              points={MOCK_RANKING_POINTS}
              seasonNumber={MOCK_RANKING_SEASON}
            />
          </CardContent>
        </Card>
        <p className='mt-3 text-center text-xs uppercase tracking-wider text-muted-foreground'>
          {t.landing.previewCaption}
        </p>
      </div>
    </section>
  );
}
