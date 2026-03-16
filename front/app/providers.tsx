'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/app/i18n';
import { AllianceProvider } from '@/app/contexts/alliance-context';

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='dark'
      disableTransitionOnChange
    >
      <SessionProvider>
        <I18nProvider>
          <AllianceProvider>{children}</AllianceProvider>
        </I18nProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
