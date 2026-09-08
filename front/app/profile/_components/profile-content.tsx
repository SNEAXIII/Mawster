'use client'

import { FullPageSpinner } from '@/components/full-page-spinner'
import { useRequiredSession } from '@/hooks/use-required-session'
import { useI18n } from '@/app/i18n'
import { useTabParam } from '@/hooks/use-tab-param'
import TabBar, { type TabItem } from '@/components/tab-bar'
import GameAccountsSection from '@/components/profile/game-accounts-section'
import { ProfileHeader } from './profile-header'
import { AccountInfoCard } from './account-info-card'
import { SignOutButton } from './sign-out-button'
import { ProfileStatsTab } from './statistics/profile-stats-tab'

type ProfileTab = 'infos' | 'stats'
const PROFILE_TABS: readonly ProfileTab[] = ['infos', 'stats']

export default function ProfileContent() {
  const { data: session, status } = useRequiredSession()
  const { t } = useI18n()

  const [activeTab, setActiveTab] = useTabParam(PROFILE_TABS, 'infos')

  // First load only: an in-flight update() also reads as loading, and the
  // spinner would remount the cards and wipe what the user just typed.
  if (status === 'loading' && !session) {
    return <FullPageSpinner />
  }

  const user = session?.user
  const s = t.profile.statistics
  const tabs: TabItem<ProfileTab>[] = [
    { value: 'infos', label: s.tabInfos, cy: 'profile-tab-infos' },
    { value: 'stats', label: s.tabStats, cy: 'profile-tab-stats' },
  ]

  return (
    <div className='max-w-5xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
      <TabBar
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'infos' && (
        <>
          <ProfileHeader
            name={user?.name}
            role={user?.role}
          />
          <div className='space-y-4 sm:space-y-6'>
            <AccountInfoCard
              name={user?.name}
              createdAt={user?.created_at}
            />
            <GameAccountsSection />
            <SignOutButton />
          </div>
        </>
      )}
      {activeTab === 'stats' && <ProfileStatsTab />}
    </div>
  )
}
