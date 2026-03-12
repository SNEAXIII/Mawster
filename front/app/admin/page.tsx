'use client';
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import clsx from 'clsx';
import UsersPanel from './_components/users-panel';
import ChampionsPanel from './_components/champions-panel';

type Tab = 'users' | 'champions';

export default function AdminPage() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const [activeTab, setActiveTab] = useState<Tab>('users');

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: t.nav.administration },
    { id: 'champions', label: t.nav.champions },
  ];

  return (
    <div className="px-3 py-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">{t.nav.administration}</h1>

      {/* Tab bar */}
      <div className="border-b mb-6">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'users' && <UsersPanel currentUserRole={session?.user?.role} />}
      {activeTab === 'champions' && <ChampionsPanel />}
    </div>
  );
}
