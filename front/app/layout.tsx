import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import SideNavBar from '@/components/left-nav-bar/sidenav';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
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
        <Providers>
          <div className='flex h-screen flex-col md:flex-row md:overflow-hidden'>
            <div className='w-full flex-none md:w-64'>
              <SideNavBar />
            </div>
            <Toaster />
            <div className='grow overflow-y-auto p-3 sm:p-6 md:p-8 lg:p-12'>{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
