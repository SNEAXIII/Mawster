'use client'

import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/app/lib/utils'
import { useI18n } from '@/app/i18n'
import { useNavLinks, useNavUser } from './nav-links'
import ModalSettings from './modal-settings'

const itemClass =
  'relative flex h-10 grow items-center justify-center rounded-md p-2 transition-colors [&_svg]:size-4'

export default function MobileNav() {
  const { t } = useI18n()
  const { isMobile } = useSidebar()
  const { isAuthenticated } = useNavUser()
  const links = useNavLinks()

  // The row keeps its height before hydration; content renders only on mobile so desktop has one set of data-cy.
  return (
    <nav className='flex min-h-14 shrink-0 items-center gap-1 overflow-x-auto px-3 py-2 md:hidden'>
      {isMobile && (
        <>
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              data-cy={link.cy}
              aria-label={link.name}
              className={cn(
                itemClass,
                'text-muted-foreground hover:text-foreground',
                link.isActive &&
                  'text-blue-400 after:absolute after:bottom-0.5 after:h-0.5 after:w-4 after:rounded-full after:bg-blue-400 hover:text-blue-400 [&_svg]:stroke-[2.5]'
              )}
            >
              <link.icon />
            </Link>
          ))}
          {!isAuthenticated && (
            <Link
              href='/login'
              data-cy='nav-sign-in'
              aria-label={t.nav.signIn}
              className={cn(itemClass, 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              <LogIn />
            </Link>
          )}
          <ModalSettings
            isAuthenticated={isAuthenticated}
            variant='icon'
          />
        </>
      )}
    </nav>
  )
}
