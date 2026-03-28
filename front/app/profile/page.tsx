'use client';

import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import GameAccountsSection from '@/components/profile/game-accounts-section';
import { ProfileHeader } from './_components/profile-header';
import { AccountInfoCard } from './_components/account-info-card';
import { SignOutButton } from './_components/sign-out-button';

export default function ProfilePage() {
  const { data: session, status } = useRequiredSession();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  const user = session?.user;

  return (
    <div className='max-w-3xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      <ProfileHeader
        name={user?.name}
        avatarUrl={user?.avatar_url}
        role={user?.role}
      />
      <AccountInfoCard
        name={user?.name}
        discordId={user?.discord_id}
        createdAt={user?.created_at}
      />
      <GameAccountsSection />
      <SignOutButton />
    </div>
  );
}
