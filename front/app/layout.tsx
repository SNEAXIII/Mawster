import '@/app/ui/global.css'
import { inter } from '@/app/ui/fonts'
import SideNavBar from '@/components/left-nav-bar/sidenav'
import TestModeBanner from '@/components/test-mode-banner'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import MyModerationProvider from './contexts/moderation-context'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL } from '@/app/lib/site'

const TITLE = 'Mawster — Alliance War planner for Marvel Contest of Champions'
const DESCRIPTION =
  'Plan Alliance War in Marvel Contest of Champions: roster management, fight history, defense placements, attack assignments, synergies and war stats.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · Mawster',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Marvel Contest of Champions',
    'MCOC',
    'alliance war',
    'war planner',
    'defense placement',
    'attack assignments',
    'roster manager',
    'roster management',
    'fight history',
    'war stats',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/logos/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logos/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
}

interface RootLayoutProps {
  readonly children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
    >
      <body className={`${inter.className} antialiased`}>
        <TestModeBanner />
        <Providers>
          <div className='flex min-h-dvh flex-col md:h-dvh md:flex-row md:overflow-hidden'>
            <div className='w-full flex-none md:w-42'>
              <SideNavBar />
            </div>
            <Toaster />
            <div className='grow p-3 md:overflow-y-auto'>
              <MyModerationProvider>{children}</MyModerationProvider>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
