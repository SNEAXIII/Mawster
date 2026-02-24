'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { formatDateLong } from '@/app/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { LuLogOut, LuShield, LuMail, LuUser, LuCalendar } from 'react-icons/lu';
import { FaDiscord } from 'react-icons/fa';
import { useI18n } from '@/app/i18n';

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const { data: session, status } = useRequiredSession();

  const handleSignOut = () => {
    signOut({
      callbackUrl: '/',
      redirect: true,
    });
  };

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  const user = session?.user;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* En-tête profil avec avatar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 ring-2 ring-offset-2 ring-blue-200">
              <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name ?? 'Avatar'} />
              <AvatarFallback className="text-2xl font-bold bg-blue-100 text-blue-700">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name ?? t.profile.user}</h1>
              <p className="text-gray-500">{user?.email ?? ''}</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <LuShield className="h-3 w-3" />
                {user?.role?.toLowerCase() ?? t.profile.user.toLowerCase()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.profile.accountInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={<LuUser className="h-4 w-4" />} label={t.profile.username} value={user?.name} fallback={t.common.notAvailable} />
            <InfoRow icon={<LuMail className="h-4 w-4" />} label={t.profile.email} value={user?.email} fallback={t.common.notAvailable} />
            <InfoRow icon={<FaDiscord className="h-4 w-4" />} label={t.profile.discordId} value={user?.discord_id} fallback={t.common.notAvailable} />
            <InfoRow icon={<LuCalendar className="h-4 w-4" />} label={t.profile.memberSince} value={user?.created_at ? formatDateLong(user.created_at, locale) : t.common.notAvailable} fallback={t.common.notAvailable} />
          </div>
        </CardContent>
      </Card>

      {/* Bouton deconnexion */}
      <Button variant="outline" className="w-full" onClick={handleSignOut}>
        <LuLogOut className="mr-2 h-4 w-4" />
        {t.profile.signOut}
      </Button>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  fallback = 'N/A',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  fallback?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-sm text-gray-900 truncate">{value ?? fallback}</p>
      </div>
    </div>
  );
}
  