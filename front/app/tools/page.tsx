'use client'

import { Suspense } from 'react'
import TabBar, { type TabItem } from '@/components/tab-bar'
import { useI18n } from '@/app/i18n'
import { useTabParam } from '@/hooks/use-tab-param'
import TierListBoard from './_components/tierlist-board'

/** The tools a player can use without an alliance, and mostly without an account. */
enum ToolsTab {
  TierList = 'tierlist',
}

const TOOLS_TABS = Object.values(ToolsTab)

function ToolsContent() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useTabParam(TOOLS_TABS, ToolsTab.TierList)

  const tabs: TabItem<ToolsTab>[] = [
    { value: ToolsTab.TierList, label: t.tierlist.title, cy: 'tab-tierlist' },
  ]

  return (
    <div className='mx-auto px-3 py-4 sm:p-6'>
      <TabBar
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === ToolsTab.TierList && <TierListBoard />}
    </div>
  )
}

export default function ToolsPage() {
  // useSearchParams needs a boundary or the whole route opts out of static
  // rendering at build time.
  return (
    <Suspense>
      <ToolsContent />
    </Suspense>
  )
}
