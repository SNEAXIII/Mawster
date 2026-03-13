'use client';

import { useI18n } from '@/app/i18n';
import { Badge } from '@/components/ui/badge';

export default function Page() {
  const { t } = useI18n();

  return (
    <div className='flex min-h-[80vh] items-center justify-center p-4'>
      <div className='text-center'>
        <h1 className='text-4xl sm:text-5xl font-bold text-foreground mb-4'>{t.common.appName}</h1>
        <Badge variant='secondary' className='mb-6 text-base px-4 py-1.5 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'>
          {t.landing.wip}
        </Badge>
        <p className='text-muted-foreground text-base sm:text-lg max-w-md mx-auto'>
          {t.landing.wipDescription}
        </p>
      </div>
    </div>
  );
}
