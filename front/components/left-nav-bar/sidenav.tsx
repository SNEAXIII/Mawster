'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import MainMawsterLogo from '@/components/MawsterLogo';
import { Button } from '@/components/ui/button';
import { VscSignIn, VscSignOut } from 'react-icons/vsc';
import NavLinks, { Role } from './nav-links';
import LanguageSwitcher from '@/components/language-switcher';
import { useI18n } from '@/app/i18n';

export default function SideNavBar() {
  const { data: session } = useSession();
  const { t } = useI18n();
  // Considérer la session comme invalide si le backend n'a pas authentifié
  const isAuthenticated = session && !session.error && session.user;
  const userRole: Role = (isAuthenticated ? session.user.role as Role : null) || Role.all;
  const router = useRouter();
  const buttonBaseClasses =
    'flex h-[48px] items-center justify-center gap-2 rounded-md p-3 text-sm font-medium transition md:justify-start md:p-2 md:px-3';
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
    <div className='flex h-full flex-col px-3 py-4 md:px-2'>
      {/* Logo Section */}
      <div className='mb-2 flex items-center gap-2'>
        <Link
          href='/'
          className='flex h-20 flex-1 items-center rounded-md bg-blue-400 p-4 transition hover:bg-blue-500'
          aria-label={t.nav.home}
        >
          <div className='w-full'>
            <MainMawsterLogo />
          </div>
        </Link>
        <LanguageSwitcher />
      </div>

      {/* Navigation Links Section */}
      <div className='flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2'>
        <NavLinks userRole={userRole} />
        <div
          className='hidden h-auto w-full grow rounded-md bg-gray-50 md:block'
          aria-hidden='true'
        ></div>

        {/* Session-specific Section */}
        {isAuthenticated ? (
          <Button
            type='button'
            onClick={handleSignOut}
            className={`${buttonBaseClasses} bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-600`}
            aria-label={t.nav.signOut}
          >
            <VscSignOut className='w-6 h-6' />
            <span className='hidden md:block'>{t.nav.signOut}</span>
          </Button>
        ) : (
          <Link
            href='/login'
            className={`${buttonBaseClasses} bg-blue-400 text-white hover:bg-blue-500`}
            aria-label={t.nav.signIn}
          >
            <VscSignIn className='w-6 h-6' />
            <span className='hidden md:block'>{t.nav.signIn}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
