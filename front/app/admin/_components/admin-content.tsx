'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import TabBar, { type TabItem } from '@/components/tab-bar';
import UsersPanel from './users-panel';
import ChampionsPanel from './champions-panel';

export enum AdminTab {
  Users = 'users',
  Champions = 'champions',
}

interface AdminContentProps {
  defaultTab?: AdminTab;
}

export default function AdminContent({ defaultTab = AdminTab.Users }: Readonly<AdminContentProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const initialTab = (searchParams.get('tab') as AdminTab) || defaultTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    Object.values(AdminTab).includes(initialTab) ? initialTab : defaultTab,
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab]);

  const tabs: TabItem<AdminTab>[] = [
    { value: AdminTab.Users, label: t.nav.users },
    { value: AdminTab.Champions, label: t.nav.champions },
  ];

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">{t.nav.administration}</h1>
      <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
      {activeTab === AdminTab.Users && <UsersPanel currentUserRole={session?.user?.role} />}
      {activeTab === AdminTab.Champions && <ChampionsPanel />}
    </div>
  );
}
