'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/app/i18n'
import TabBar, { type TabItem } from '@/components/tab-bar'
import HistoryTab from './_components/history-tab'
import MatchupsTab from './_components/matchups-tab'

type KnowledgeBaseTab = 'history' | 'matchups'
const TABS: KnowledgeBaseTab[] = ['history', 'matchups']

function KnowledgeBaseContent() {
  const { t } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = searchParams.get('tab') as KnowledgeBaseTab
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>(
    TABS.includes(initialTab) ? initialTab : 'history'
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

  const kb = t.game.knowledgeBase
  const tabs: TabItem<KnowledgeBaseTab>[] = [
    { value: 'history', label: kb.tabHistory, cy: 'kb-tab-history' },
    { value: 'matchups', label: kb.tabMatchups, cy: 'kb-tab-matchups' },
  ]

  return (
    <div className='px-3 py-4 sm:p-6 flex flex-col gap-4'>
      <TabBar
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'matchups' && <MatchupsTab />}
    </div>
  )
}

export default function KnowledgeBasePage() {
  return (
    <Suspense>
      <KnowledgeBaseContent />
    </Suspense>
  )
}
