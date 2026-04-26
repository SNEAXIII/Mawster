import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import SideNavBar from '@/components/left-nav-bar/sidenav';
import TestModeBanner from '@/components/test-mode-banner';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { DevInspector } from './_components/dev-inspector';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/logos/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logos/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

interface RootLayoutProps {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
    >
      <body className={`${inter.className} antialiased`}>
        <TestModeBanner />
        <DevInspector />
        <Providers>
          <div className='flex h-screen flex-col md:flex-row md:overflow-hidden'>
            <div className='w-full flex-none md:w-64'>
              <SideNavBar />
            </div>
            <Toaster />
            <div className='grow overflow-y-auto p-3'>{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
