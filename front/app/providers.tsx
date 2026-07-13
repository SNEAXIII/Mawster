'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { I18nProvider } from '@/app/i18n'
import { AllianceProvider } from '@/app/contexts/alliance-context'
import { signOutAndRedirect } from '@/app/lib/sign-out'
import { useEffect } from 'react'

function SessionWatcher() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === 'TokenExpiredError') {
      signOutAndRedirect('/login')
    }
  }, [session?.error])

  return null
}

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='dark'
      disableTransitionOnChange
    >
      <SessionProvider
        refetchInterval={45 * 60}
        refetchOnWindowFocus={true}
      >
        <SessionWatcher />
        <I18nProvider>
          <AllianceProvider>{children}</AllianceProvider>
        </I18nProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
