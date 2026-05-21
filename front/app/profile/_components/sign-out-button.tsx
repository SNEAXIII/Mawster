import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const { t } = useI18n();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login', redirect: true });
  };

  return (
    <>
      <Separator />
      <Button
        variant='destructive'
        className='w-full'
        data-cy='sign-out-btn'
        onClick={handleSignOut}
      >
        <LogOut className='mr-2 size-4' />
        {t.profile.signOut}
      </Button>
    </>
  );
}
