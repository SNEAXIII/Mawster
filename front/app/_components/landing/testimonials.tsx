'use client';

import { useI18n } from '@/app/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { TESTIMONIALS } from './testimonials-data';

export function Testimonials() {
  const { t } = useI18n();

  return (
    <section className='px-6 py-20 md:px-12'>
      <div className='mx-auto max-w-6xl'>
        <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{t.landing.testimonialsTitle}
        </h2>

        <div className='mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {TESTIMONIALS.map((x) => (
            <Card key={`${x.name}-${x.alliance}`}>
              <CardContent className='pt-6'>
                <p className='leading-relaxed text-foreground'>&ldquo;{x.quote}&rdquo;</p>
                <p className='mt-4 text-sm font-semibold'>{x.name}</p>
                <p className='text-sm text-muted-foreground'>
                  {x.role} · {x.alliance}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
