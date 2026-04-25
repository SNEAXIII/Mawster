'use client';

import dynamic from 'next/dynamic';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import TabBar, { type TabItem } from '@/components/tab-bar';
import CreateAllianceForm from './create-alliance-form';
import AllianceRosterDialog from './alliance-roster-dialog';
import InvitationsSection from './invitations-section';
import AlliancesTab from './alliances-tab';
import AllianceStatisticsTab from './alliance-statistics-tab';
import { useAlliancesViewModel, AllianceTab } from '../_viewmodels/use-alliances-viewmodel';

const DefensePageContent = dynamic(() => import('../../defense/_components/defense-content'), {
  loading: () => <FullPageSpinner />,
});

export default function AllianceContent() {
  const vm = useAlliancesViewModel();
  const { t } = useI18n();

  if (vm.status === 'loading' || vm.loading) return <FullPageSpinner />;

  const tabs: TabItem<AllianceTab>[] = [
    ...(vm.eligibleOwners.length > 0
      ? [{ value: AllianceTab.Create, label: t.game.alliances.createTitle, cy: 'tab-create' }]
      : []),
    { value: AllianceTab.Alliances, label: t.game.alliances.title, cy: 'tab-alliances' },
    {
      value: AllianceTab.Statistics,
      label: t.game.alliances.statistics.tabLabel,
      cy: 'tab-statistics',
    },
    { value: AllianceTab.Defense, label: t.nav.defense, cy: 'tab-defense' },
  ];

  return (
    <AllianceRoleProvider refreshKey={vm.roleRefreshKey}>
      <div className='w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
        {vm.myInvitations.length > 0 && (
          <InvitationsSection
            invitations={vm.myInvitations}
            onAccept={vm.handleAcceptInvitation}
            onDecline={vm.handleDeclineInvitation}
          />
        )}

        <TabBar
          tabs={tabs}
          value={vm.activeTab}
          onChange={vm.setActiveTab}
        />

        {vm.activeTab === AllianceTab.Create && vm.eligibleOwners.length > 0 && (
          <CreateAllianceForm
            hasAnyAccounts={vm.hasAnyAccounts}
            eligibleOwners={vm.eligibleOwners}
            name={vm.name}
            tag={vm.tag}
            ownerId={vm.ownerId}
            creating={vm.creating}
            onNameChange={vm.setName}
            onTagChange={vm.setTag}
            onOwnerChange={vm.setOwnerId}
            onSubmit={vm.handleCreate}
          />
        )}

        {vm.activeTab === AllianceTab.Alliances && (
          <AlliancesTab
            alliances={vm.alliances}
            locale={vm.locale}
            memberAllianceId={vm.memberAllianceId}
            memberAccountId={vm.memberAccountId}
            eligibleMembers={vm.eligibleMembers}
            pendingInvitations={vm.pendingInvitations}
            onMemberAccountChange={vm.setMemberAccountId}
            onOpenInviteMember={vm.handleOpenInviteMember}
            onCloseInviteMember={vm.handleCloseInviteMember}
            onInviteMember={vm.handleInviteMember}
            onRefresh={vm.handleMemberRefresh}
            onViewRoster={(gameAccountId, pseudo, canReq) =>
              vm.setRosterTarget({ gameAccountId, pseudo, canRequestUpgrade: canReq })
            }
            onCancelInvitation={vm.handleCancelInvitation}
          />
        )}

        {vm.activeTab === AllianceTab.Defense && (
          <DefensePageContent
            onStateChange={vm.handleDefenseStateChange}
            initialAllianceId={vm.searchParams.get('alliance') ?? undefined}
            initialBg={vm.searchParams.get('bg') ? Number(vm.searchParams.get('bg')) : undefined}
          />
        )}

        {vm.activeTab === AllianceTab.Statistics && (
          <AllianceStatisticsTab
            alliances={vm.alliances}
            selectedAllianceId={vm.statsAllianceId}
            onAllianceChange={vm.handleStatsAllianceChange}
            seasonStats={vm.seasonStats}
            statsLoading={vm.statsLoading}
            statsError={vm.statsError}
            onRetry={vm.handleRefreshStatistics}
          />
        )}

        <AllianceRosterDialog
          open={!!vm.rosterTarget}
          onOpenChange={(open) => {
            if (!open) vm.setRosterTarget(null);
          }}
          gameAccountId={vm.rosterTarget?.gameAccountId ?? null}
          gamePseudo={vm.rosterTarget?.pseudo ?? ''}
          canRequestUpgrade={vm.rosterTarget?.canRequestUpgrade ?? false}
        />
      </div>
    </AllianceRoleProvider>
  );
}
