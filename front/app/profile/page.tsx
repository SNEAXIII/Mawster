'use client';

import { useState } from 'react';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { useI18n } from '@/app/i18n';
import TabBar, { type TabItem } from '@/components/tab-bar';
import GameAccountsSection from '@/components/profile/game-accounts-section';
import { ProfileHeader } from './_components/profile-header';
import { AccountInfoCard } from './_components/account-info-card';
import { SignOutButton } from './_components/sign-out-button';
import { ProfileStatsTab } from './_components/statistics/profile-stats-tab';

type ProfileTab = 'infos' | 'stats';

export default function ProfilePage() {
  const { data: session, status } = useRequiredSession();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ProfileTab>('infos');

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  const user = session?.user;
  const s = t.profile.statistics;
  const tabs: TabItem<ProfileTab>[] = [
    { value: 'infos', label: s.tabInfos, cy: 'profile-tab-infos' },
    { value: 'stats', label: s.tabStats, cy: 'profile-tab-stats' },
  ];

  return (
    <div className='max-w-5xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      {activeTab === 'infos' && (
        <>
          <ProfileHeader name={user?.name} role={user?.role} />
          <div className='space-y-4 sm:space-y-6'>
            <AccountInfoCard name={user?.name} createdAt={user?.created_at} />
            <GameAccountsSection />
            <SignOutButton />
          </div>
        </>
      )}
      {activeTab === 'stats' && <ProfileStatsTab />}
    </div>
  );
}
