'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/app/i18n';

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='dark'
      disableTransitionOnChange
    >
      <SessionProvider>
        <I18nProvider>{children}</I18nProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
