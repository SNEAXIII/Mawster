'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { useRequiredSession } from '@/hooks/use-required-session'
import { useI18n } from '@/app/i18n'
import TabBar, { type TabItem } from '@/components/tab-bar'
import GameAccountsSection from '@/components/profile/game-accounts-section'
import { ProfileHeader } from './profile-header'
import { AccountInfoCard } from './account-info-card'
import { SignOutButton } from './sign-out-button'
import { ProfileStatsTab } from './statistics/profile-stats-tab'

type ProfileTab = 'infos' | 'stats'
const PROFILE_TABS: ProfileTab[] = ['infos', 'stats']

export default function ProfileContent() {
  const { data: session, status } = useRequiredSession()
  const { t } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = searchParams.get('tab') as ProfileTab
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    PROFILE_TABS.includes(initialTab) ? initialTab : 'infos'
  )

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  if (status === 'loading') {
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
