'use client';

import { useI18n } from '@/app/i18n';
import TabBar, { type TabItem } from '@/components/tab-bar';
import UsersPanel from './users-panel';
import ChampionsPanel from './champions-panel';
import SeasonsPanel from './seasons-panel';
import { useAdminViewModel, AdminTab } from '../_viewmodels/use-admin-viewmodel';

interface AdminContentProps {
  defaultTab?: AdminTab;
}

export default function AdminContent({ defaultTab = AdminTab.Users }: Readonly<AdminContentProps>) {
  const vm = useAdminViewModel({ defaultTab });
  const { t } = useI18n();

  const tabs: TabItem<AdminTab>[] = [
    { value: AdminTab.Users, label: t.nav.users },
    { value: AdminTab.Champions, label: t.nav.champions },
    { value: AdminTab.Seasons, label: t.nav.seasons },
  ];

  if (vm.status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className='px-3 py-4 sm:p-6'>
      <TabBar tabs={tabs} value={vm.activeTab} onChange={vm.setActiveTab} />
      {vm.activeTab === AdminTab.Users && <UsersPanel currentUserRole={vm.session?.user?.role} />}
      {vm.activeTab === AdminTab.Champions && <ChampionsPanel />}
      {vm.activeTab === AdminTab.Seasons && <SeasonsPanel />}
    </div>
  );
}
