'use client'

import { redirect, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTabParam } from '@/hooks/use-tab-param'

export enum AdminTab {
  Users = 'users',
  Champions = 'champions',
  Seasons = 'seasons',
  KnowledgeBase = 'knowledge-base',
  VisionImports = 'vision-imports',
  Moderation = 'moderation',
}

const ADMIN_TABS = Object.values(AdminTab)

interface UseAdminViewModelOptions {
  defaultTab?: AdminTab
}

export function useAdminViewModel({ defaultTab = AdminTab.Users }: UseAdminViewModelOptions = {}) {
  const pathname = usePathname()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`)
    },
  })

  const [activeTab, setActiveTab] = useTabParam(ADMIN_TABS, defaultTab)

  return {
    session,
    status,
    activeTab,
    setActiveTab,
  }
}
