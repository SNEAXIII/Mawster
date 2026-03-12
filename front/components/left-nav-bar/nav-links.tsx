'use client';
import { Home, User, Sword, Shield, ShieldCheck, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { cn } from '@/app/lib/utils';

export enum Role {
  all = 'all',
  user = 'user',
  admin = 'admin',
  superAdmin = 'super_admin'
}
const roleHierarchy: Record<Role, Role[]> = {
  [Role.all]: [Role.all],
  [Role.user]: [Role.all, Role.user],
  [Role.admin]: [Role.all, Role.user, Role.admin],
  [Role.superAdmin]: [Role.all, Role.user, Role.admin, Role.superAdmin],
};
interface NavLinksProps {
  userRole: Role;
}

export default function NavLinks({ userRole }: Readonly<NavLinksProps>) {
  const pathname = usePathname();
  const { t } = useI18n();

  const links = [
    { name: t.nav.home, href: '/', icon: Home, role: Role.all, cy: 'nav-home' },
    { name: t.nav.profile, href: '/profile', icon: User, role: Role.user, cy: 'nav-profile' },
    { name: t.nav.roster, href: '/game/roster', icon: Sword, role: Role.user, cy: 'nav-roster' },
    { name: t.nav.alliances, href: '/game/alliances', icon: Shield, role: Role.user, cy: 'nav-alliances' },
    { name: t.nav.defense, href: '/game/defense', icon: ShieldCheck, role: Role.user, cy: 'nav-defense' },
    {
      name: t.nav.administration,
      href: '/admin',
      icon: Settings,
      role: Role.admin,
      cy: 'nav-administration',
    },
  ];

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        if (!roleHierarchy[userRole]?.includes(link.role)) {
          return null;
        }
        const isActive = (pathname.startsWith(link.href) && link.href !== '/') || pathname === link.href;
        return (
          <Link
            key={link.name}
            href={link.href}
            data-cy={link.cy}
            className={cn(
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-muted/50 p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground md:flex-none md:justify-start md:p-2 md:px-3',
              isActive && 'bg-accent text-accent-foreground font-semibold',
            )}
          >
            <LinkIcon className='h-5 w-5 shrink-0' />
            <p className='hidden md:block'>{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
