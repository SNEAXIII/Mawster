'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import LanguageSwitcher from '@/components/language-switcher';
import ThemePicker from '@/components/theme-picker';
import { useI18n } from '@/app/i18n';

export default function MobileSettingsSheet() {
  const { t } = useI18n();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          data-cy='mobile-settings-trigger'
          variant='ghost'
          className='flex h-[48px] w-full items-center justify-center rounded-md p-3 md:hidden'
          aria-label={t.nav.settings}
        >
          <Settings className='h-5 w-5' />
        </Button>
      </SheetTrigger>
      <SheetContent side='bottom' className='md:hidden' data-cy='mobile-settings-sheet'>
        <SheetHeader>
          <SheetTitle>{t.nav.settings}</SheetTitle>
        </SheetHeader>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>{t.nav.language}</span>
            <LanguageSwitcher />
          </div>
          <Separator />
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>{t.nav.theme}</span>
            <ThemePicker />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
