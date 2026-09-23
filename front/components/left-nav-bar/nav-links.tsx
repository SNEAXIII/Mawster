'use client'
import { Home, User, Sword, Shield, Swords, UserStar, BookOpen, Wrench } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { useI18n } from '@/app/i18n'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

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
export function useNavUser() {
  const { data: session } = useSession()
  const { hasAlliance } = useAllianceContext()
  const isAuthenticated = Boolean(session && !session.error && session.user)
  const userRole: Role = (isAuthenticated ? (session?.user.role as Role) : null) ?? Role.all
  return { isAuthenticated, userRole, hasAlliance }
}

export function useNavLinks() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { userRole, hasAlliance } = useNavUser()

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

  return links
    .filter(
      (link) =>
        roleHierarchy[userRole]?.includes(link.role) && !(link.requiresAlliance && !hasAlliance)
    )
    .map((link) => ({
      ...link,
      isActive: (pathname.startsWith(link.href) && link.href !== '/') || pathname === link.href,
    }))
}

export default function NavLinks() {
  const links = useNavLinks()

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.name}>
          <SidebarMenuButton
            asChild
            isActive={link.isActive}
            tooltip={link.name}
          >
            <Link
              href={link.href}
              data-cy={link.cy}
            >
              <link.icon />
              <span>{link.name}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
