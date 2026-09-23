'use client'

import Link from 'next/link'
import { LogIn, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MawsterLogo } from '@/components/MawsterLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import NavLinks, { useNavUser } from './nav-links'
import ModalSettings from './modal-settings'
import { useI18n } from '@/app/i18n'

export default function SideNavBar() {
  const { t } = useI18n()
  const { isMobile, state, toggleSidebar } = useSidebar()
  const { isAuthenticated } = useNavUser()

  // Mobile gets MobileNav instead of the sidebar's sheet.
  if (isMobile) return null

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        {/* Not a SidebarMenuButton: its lg size shrinks to size-8 when collapsed and shifts the whole nav. */}
        <Link
          href='/'
          aria-label={t.nav.home}
          className='flex h-8 items-center gap-2 overflow-hidden rounded-md outline-hidden ring-sidebar-ring focus-visible:ring-2'
        >
          <div className='flex size-8 shrink-0 items-center justify-center rounded-md bg-primary [&_img]:size-6'>
            <MawsterLogo />
          </div>
          <span className='truncate text-base font-semibold'>Mawster</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <NavLinks />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {!isAuthenticated && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t.nav.signIn}
                className='bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              >
                <Link
                  href='/login'
                  data-cy='nav-sign-in'
                >
                  <LogIn />
                  <span>{t.nav.signIn}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <ModalSettings
              isAuthenticated={isAuthenticated}
              variant='menu'
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={t.nav.expandSidebar}
              className='text-muted-foreground'
            >
              {state === 'collapsed' ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>{t.nav.collapseSidebar}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
