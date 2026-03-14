'use client';

import { signOut } from 'next-auth/react';
import { formatDateLong } from '@/app/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { LogOut, Shield, Mail, User, Calendar } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useI18n } from '@/app/i18n';
import GameAccountsSection from '@/components/profile/game-accounts-section';

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
  const { locale, t } = useI18n();

  const { data: session, status } = useRequiredSession();

  const handleSignOut = () => {
    signOut({
      callbackUrl: '/login',
      redirect: true,
    });
  };

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  const user = session?.user;

  return (
    <div className='max-w-3xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      {/* En-tête profil avec avatar */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col sm:flex-row items-center gap-4 sm:gap-6'>
            <Avatar className='h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-offset-2 ring-primary/20'>
              <AvatarImage
                src={user?.avatar_url ?? undefined}
                alt={user?.name ?? 'Avatar'}
              />
              <AvatarFallback className='text-xl sm:text-2xl font-bold bg-primary/10 text-primary'>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className='text-center sm:text-left space-y-1.5'>
              <h1 className='text-xl sm:text-2xl font-bold'>{user?.name ?? t.profile.user}</h1>
              <p className='text-muted-foreground text-sm'>{user?.email ?? ''}</p>
              <Badge
                variant='secondary'
                className='gap-1'
              >
                <Shield className='h-3 w-3' />
                {user?.role?.toLowerCase() ?? t.profile.user.toLowerCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations du compte */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>{t.profile.accountInfo}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
            <InfoRow
              icon={<User className='h-4 w-4' />}
              label={t.profile.username}
              value={user?.name}
              fallback={t.common.notAvailable}
              dataCy='username-row'
            />
            <InfoRow
              icon={<Mail className='h-4 w-4' />}
              label={t.profile.email}
              value={user?.email}
              fallback={t.common.notAvailable}
              dataCy='email-row'
            />
            <InfoRow
              icon={<FaDiscord className='h-4 w-4' />}
              label={t.profile.discordId}
              value={user?.discord_id}
              fallback={t.common.notAvailable}
              dataCy='discord-id-row'
            />
            <InfoRow
              icon={<Calendar className='h-4 w-4' />}
              label={t.profile.memberSince}
              value={
                user?.created_at ? formatDateLong(user.created_at, locale) : t.common.notAvailable
              }
              fallback={t.common.notAvailable}
              dataCy='member-since-row'
            />
          </div>
        </CardContent>
      </Card>

      {/* Game accounts management */}
      <GameAccountsSection />

      {/* Bouton deconnexion */}
      <Separator />
      <Button
        variant='outline'
        className='w-full'
        data-cy='sign-out-btn'
        onClick={handleSignOut}
      >
        <LogOut className='mr-2 h-4 w-4' />
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
  dataCy,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  fallback?: string;
  dataCy?: string;
}>) {
  return (
    <div
      className='flex items-start gap-3 p-3 rounded-lg bg-muted/50'
      data-cy={dataCy}
    >
      <div className='mt-0.5 text-muted-foreground'>{icon}</div>
      <div className='min-w-0'>
        <p className='text-xs font-medium text-muted-foreground'>{label}</p>
        <p className='mt-0.5 text-sm truncate'>{value ?? fallback}</p>
      </div>
    </div>
  );
}
