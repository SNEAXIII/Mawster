'use client';

import { useI18n } from '@/app/i18n';
import RosterImportExport from '@/components/roster-import-export';
import { ErrorBanner } from '@/components/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import { RosterDialogs } from './roster-dialogs';
import TabBar, { type TabItem } from '@/components/tab-bar';
import GameAccountsSection from '@/components/profile/game-accounts-section';
import AddChampionForm from './add-champion-form';
import RosterGrid from './roster-grid';
import RosterUpgradeSection from './roster-upgrade-section';
import { useRosterViewModel, RosterTab } from '../_viewmodels/use-roster-viewmodel';
import MasteryTab from './mastery-tab';

export default function RosterContent() {
  const vm = useRosterViewModel();
  const { t } = useI18n();

  if (vm.authStatus === 'loading' || vm.loadingAccounts) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>{t.common.loading}</p>
      </div>
    );
  }

  const tabs: TabItem<RosterTab>[] = [
    ...(vm.accounts.length > 0
      ? [{ value: RosterTab.Roster, label: t.roster.title, cy: 'tab-roster' }]
      : []),
    { value: RosterTab.Mastery, label: t.mastery.tabLabel, cy: 'tab-mastery' },
    { value: RosterTab.Accounts, label: t.roster.manageTab, cy: 'tab-manage' },
  ];

  return (
    <AllianceRoleProvider>
      <div className='px-3 py-4 sm:p-6 max-w-6xl mx-auto'>
        <TabBar tabs={tabs} value={vm.activeTab} onChange={vm.setActiveTab} />

        {vm.activeTab === RosterTab.Roster && (
          <>
            {vm.accounts.length === 0 ? (
              <p className='text-muted-foreground'>{t.roster.noAccounts}</p>
            ) : (
              <>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2'>
                  {vm.accounts.length > 1 && (
                    <div className='mb-6'>
                      <label className='block text-sm font-medium mb-2'>{t.roster.selectAccount}</label>
                      <Select
                        value={vm.selectedAccountId || ''}
                        onValueChange={(val) => vm.setSelectedAccountId(val || null)}
                      >
                        <SelectTrigger className='w-full max-w-xs' data-cy='roster-account-select'>
                          <SelectValue placeholder={t.roster.chooseAccount} />
                        </SelectTrigger>
                        <SelectContent>
                          {vm.accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.game_pseudo}{acc.is_primary ? ` (${t.game.accounts.primary})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {vm.selectedAccountId && (
                    <RosterImportExport
                      roster={vm.roster}
                      selectedAccountId={vm.selectedAccountId}
                      selectedAccountName={vm.accounts.find((a) => a.id === vm.selectedAccountId)?.game_pseudo ?? ''}
                      onRosterUpdated={(updated) => vm.handleFormSuccess(updated)}
                    />
                  )}
                </div>

                {vm.error && (
                  <ErrorBanner message={vm.error} onDismiss={vm.clearError} className='mb-4' />
                )}

                {vm.selectedAccountId && (
                  <>
                    <AddChampionForm
                      open={vm.showAddForm}
                      onOpenChange={vm.setShowAddForm}
                      selectedAccountId={vm.selectedAccountId}
                      roster={vm.roster}
                      initialEntry={vm.editEntry}
                      onSuccess={vm.handleFormSuccess}
                    />
                    <RosterUpgradeSection
                      selectedAccountId={vm.selectedAccountId}
                      allianceId={vm.accounts.find((a) => a.id === vm.selectedAccountId)?.alliance_id ?? null}
                      refreshKey={vm.upgradeRefreshKey}
                    />
                    {vm.loadingRoster ? (
                      <p className='text-muted-foreground'>{t.common.loading}</p>
                    ) : (
                      <RosterGrid
                        groupedRoster={vm.groupedRoster}
                        onEdit={vm.startEditEntry}
                        onDelete={vm.setDeleteTarget}
                        onUpgrade={vm.setUpgradeTarget}
                        onTogglePreferredAttacker={vm.handleTogglePreferredAttacker}
                        onAscend={vm.setAscendTarget}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {vm.activeTab === RosterTab.Mastery && (
          <MasteryTab
            masteries={vm.masteries}
            masteryForm={vm.masteryForm}
            loading={vm.loadingMasteries}
            saving={vm.savingMasteries}
            isOwner={vm.accounts.some((a) => a.id === vm.selectedAccountId)}
            onFieldChange={vm.updateMasteryField}
            onSave={vm.handleSaveMasteries}
          />
        )}

        {vm.activeTab === RosterTab.Accounts && (
          <GameAccountsSection onAccountsChange={vm.fetchAccounts} />
        )}

        <RosterDialogs
          deleteTarget={vm.deleteTarget}
          setDeleteTarget={vm.setDeleteTarget}
          confirmDelete={vm.confirmDelete}
          upgradeTarget={vm.upgradeTarget}
          setUpgradeTarget={vm.setUpgradeTarget}
          confirmUpgrade={vm.confirmUpgrade}
          ascendTarget={vm.ascendTarget}
          setAscendTarget={vm.setAscendTarget}
          confirmAscend={vm.confirmAscend}
        />
      </div>
    </AllianceRoleProvider>
  );
}
