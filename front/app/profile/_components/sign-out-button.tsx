import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { signOutAndRedirect } from '@/app/lib/sign-out';

export function SignOutButton() {
  const { t } = useI18n();

  return (
    <>
      <Separator />
      <Button
        variant='destructive'
        className='w-full'
        data-cy='sign-out-btn'
        onClick={() => signOutAndRedirect()}
      >
        <LogOut className='mr-2 size-4' />
        {t.profile.signOut}
      </Button>
    </>
  );
}
