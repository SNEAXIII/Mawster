'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import MainMawsterLogo from '@/components/MawsterLogo'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import ModalSettings from './modal-settings'
import { useI18n } from '@/app/i18n'

export default function MobileHeader() {
  const { data: session } = useSession()
  const { t } = useI18n()
  const { isMobile } = useSidebar()
  const isAuthenticated = Boolean(session && !session.error && session.user)

  return (
    <header className='sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2 md:hidden'>
      <SidebarTrigger aria-label={t.nav.openMenu} />
      <Link
        href='/'
        aria-label={t.nav.home}
        className='flex grow items-center [&_p]:text-base [&_p]:text-foreground [&_img]:size-7'
      >
        <MainMawsterLogo />
      </Link>
      {isMobile && (
        <ModalSettings
          isAuthenticated={isAuthenticated}
          variant='icon'
        />
      )}
    </header>
  )
}
