'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import MainMawsterLogo from '@/components/MawsterLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogIn } from 'lucide-react';
import NavLinks, { Role } from './nav-links';
import LanguageSwitcher from '@/components/language-switcher';
import ThemePicker from '@/components/theme-picker';
import ModaleSettings from './mobile-settings-sheet';
import { useI18n } from '@/app/i18n';
import { useAllianceContext } from '@/app/contexts/alliance-context';

export default function SideNavBar() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const isAuthenticated = session && !session.error && session.user;
  const userRole: Role = (isAuthenticated ? (session.user.role as Role) : null) || Role.all;
  const { hasAlliance } = useAllianceContext();


  return (
    <div className='flex h-full flex-col px-3 py-2 md:py-4 md:px-2'>
      {/* Logo Section — hidden on mobile */}
      <div className='hidden md:flex mb-2 items-center gap-2'>
        <Link
          href='/'
          className='flex h-20 flex-1 items-center rounded-md bg-primary p-4 transition hover:bg-primary/90'
          aria-label={t.nav.home}
        >
          <div className='w-full'>
            <MainMawsterLogo />
          </div>
        </Link>

      </div>

      {/* Navigation Links Section */}
      <div className='flex grow flex-row justify-between gap-1 md:flex-col md:gap-2 overflow-x-auto md:overflow-x-visible'>
        <NavLinks userRole={userRole} hasAlliance={hasAlliance} />
        <div
          className='hidden h-auto w-full grow rounded-md bg-muted/50 md:block'
          aria-hidden='true'
        />
        <Separator className='hidden md:block' />
        {isAuthenticated ? (
            <ModaleSettings />
        ) : (
          <Link
            href='/login'
            className='
            flex items-center justify-center gap-2 rounded-md p-3 text-sm font-medium md:justify-start h-12 min-w-12
            bg-primary text-primary-foreground transition hover:bg-primary/90 md:px-3'
            aria-label={t.nav.signIn}
          >
            <LogIn className='h-5 w-5' />
            <span className='hidden md:block'>{t.nav.signIn}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
