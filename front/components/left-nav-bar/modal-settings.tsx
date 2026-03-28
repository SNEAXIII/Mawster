'use client';

import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import LanguageSwitcher from '@/components/language-switcher';
import ThemePicker from '@/components/theme-picker';
import { useI18n } from '@/app/i18n';
import { useRouter } from 'next/dist/client/components/navigation';
import { signOut } from 'next-auth/react';

export default function ModalSettings() {
  const { t } = useI18n();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-cy='modal-settings-trigger'
          variant='ghost'
          className='flex h-12 min-w-12 items-center justify-center rounded-md p-3'
          aria-label={t.nav.settings}
        >
          <Settings className='h-5 w-5' />
        </Button>
      </DialogTrigger>
      <DialogContent data-cy='modal-settings-content'>
        <DialogHeader>
          <DialogTitle>{t.nav.settings}</DialogTitle>
        </DialogHeader>
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
          <Separator />
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>{t.nav.signOut}</span>
            <Button
              type='button'
              variant='destructive'
              onClick={handleSignOut}
              className='px-2 hover:bg-destructive/30 hover:text-destructive'
              aria-label={t.nav.signOut}
              data-cy='modal-settings-sign-out'
            >
              <LogOut className='h-5 w-5' />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
