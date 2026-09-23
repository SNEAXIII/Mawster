'use client'
import { Home, User, Sword, Shield, Swords, UserStar, BookOpen, Wrench } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/app/i18n'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export enum Role {
  all = 'all',
  user = 'user',
  admin = 'admin',
  superAdmin = 'super_admin',
}
const roleHierarchy: Record<Role, Role[]> = {
  [Role.all]: [Role.all],
  [Role.user]: [Role.all, Role.user],
  [Role.admin]: [Role.all, Role.user, Role.admin],
  [Role.superAdmin]: [Role.all, Role.user, Role.admin, Role.superAdmin],
}
interface NavLinksProps {
  userRole: Role
  hasAlliance: boolean
}

export default function NavLinks({ userRole, hasAlliance }: Readonly<NavLinksProps>) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { setOpenMobile } = useSidebar()

  const links = [
    { name: t.nav.home, href: '/', icon: Home, role: Role.all, cy: 'nav-home' },
    { name: t.nav.profile, href: '/profile', icon: User, role: Role.user, cy: 'nav-profile' },
    { name: t.nav.roster, href: '/game/account', icon: Sword, role: Role.user, cy: 'nav-roster' },
    {
      name: t.nav.alliances,
      href: '/game/alliances',
      icon: Shield,
      role: Role.user,
      cy: 'nav-alliances',
    },
    {
      name: t.nav.war,
      href: '/game/war',
      icon: Swords,
      role: Role.user,
      cy: 'nav-war',
      requiresAlliance: true,
    },
    {
      name: t.nav.knowledgeBase,
      href: '/game/knowledge-base',
      icon: BookOpen,
      role: Role.user,
      cy: 'nav-knowledge-base',
      requiresAlliance: true,
    },
    {
      name: t.nav.tools,
      href: '/tools',
      icon: Wrench,
      role: Role.all,
      cy: 'nav-tools',
    },
    {
      name: t.nav.administration,
      href: '/admin',
      icon: UserStar,
      role: Role.admin,
      cy: 'nav-administration',
    },
  ]

  return (
    <SidebarMenu>
      {links.map((link) => {
        const LinkIcon = link.icon
        if (!roleHierarchy[userRole]?.includes(link.role)) {
          return null
        }
        if (link.requiresAlliance && !hasAlliance) {
          return null
        }
        const isActive =
          (pathname.startsWith(link.href) && link.href !== '/') || pathname === link.href
        return (
          <SidebarMenuItem key={link.name}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={link.name}
            >
              <Link
                href={link.href}
                data-cy={link.cy}
                onClick={() => setOpenMobile(false)}
              >
                <LinkIcon />
                <span>{link.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
