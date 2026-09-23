'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
import NavLinks, { Role } from './nav-links'
import ModalSettings from './modal-settings'
import { useI18n } from '@/app/i18n'
import { useAllianceContext } from '@/app/contexts/alliance-context'

export default function SideNavBar() {
  const { data: session } = useSession()
  const { t } = useI18n()
  const { isMobile, state, toggleSidebar, setOpenMobile } = useSidebar()
  const isAuthenticated = Boolean(session && !session.error && session.user)
  const userRole: Role = (isAuthenticated ? (session?.user.role as Role) : null) ?? Role.all
  const { hasAlliance } = useAllianceContext()
  const isCollapsed = state === 'collapsed'

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        {/* Not a SidebarMenuButton: its lg size shrinks to size-8 when collapsed and shifts the whole nav. */}
        <Link
          href='/'
          aria-label={t.nav.home}
          onClick={() => setOpenMobile(false)}
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
          <NavLinks
            userRole={userRole}
            hasAlliance={hasAlliance}
          />
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
                  onClick={() => setOpenMobile(false)}
                >
                  <LogIn />
                  <span>{t.nav.signIn}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {/* On mobile the settings trigger lives in MobileHeader, so it stays reachable with the sheet closed. */}
          {!isMobile && (
            <>
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
                  {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                  <span>{t.nav.collapseSidebar}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
