'use client';
import { MdOutlineAdminPanelSettings, MdPersonOutline } from 'react-icons/md';
import { IoHomeOutline, IoGameControllerOutline, IoTrophyOutline } from 'react-icons/io5';
import { RiShieldLine, RiSwordLine, RiShieldStarLine } from 'react-icons/ri';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';

import clsx from 'clsx';

export enum Role {
  all = 'all',
  user = 'user',
  admin = 'admin',
}
const roleHierarchy: Record<Role, Role[]> = {
  [Role.all]: [Role.all],
  [Role.user]: [Role.all, Role.user],
  [Role.admin]: [Role.all, Role.user, Role.admin],
};
interface NavLinksProps {
  userRole: Role;
}

export default function NavLinks({ userRole }: Readonly<NavLinksProps>) {
  const pathname = usePathname();
  const { t } = useI18n();

  const links = [
    { name: t.nav.home, href: '/', icon: IoHomeOutline, role: Role.all },
    { name: t.nav.profile, href: '/profile', icon: MdPersonOutline, role: Role.user },
    { name: t.nav.gameAccounts, href: '/game/accounts', icon: IoGameControllerOutline, role: Role.user },
    { name: t.nav.roster, href: '/game/roster', icon: RiSwordLine, role: Role.user },
    { name: t.nav.alliances, href: '/game/alliances', icon: RiShieldLine, role: Role.user },
    { name: t.nav.defense, href: '/game/defense', icon: RiShieldStarLine, role: Role.user },
    { name: t.nav.champions, href: '/admin/champions', icon: IoTrophyOutline, role: Role.admin },
    {
      name: t.nav.administration,
      href: '/admin/dashboard',
      icon: MdOutlineAdminPanelSettings,
      role: Role.admin,
    },
  ];

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        if (!roleHierarchy[userRole]?.includes(link.role)) {
          return null;
        }
        return (
          <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-sky-100 text-blue-600': pathname.startsWith(link.href) && link.href !== '/' || pathname === link.href,
              }
            )}
          >
            <LinkIcon
              className='w-6'
              size={70}
            />
            <p className='hidden md:block'>{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
