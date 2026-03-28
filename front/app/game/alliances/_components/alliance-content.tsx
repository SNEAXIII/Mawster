'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type Alliance,
  type GameAccount,
  type AllianceInvitation,
  getMyGameAccounts,
  getEligibleOwners,
  getEligibleMembers,
  createAlliance,
  inviteMember,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  getAllianceInvitations,
  cancelInvitation,
  getMyAllianceRoles,
} from '@/app/services/game';

import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import { useAllianceContext } from '@/app/contexts/alliance-context';
import TabBar, { type TabItem } from '@/components/tab-bar';

import CreateAllianceForm from './create-alliance-form';
import AllianceRosterDialog from './alliance-roster-dialog';
import InvitationsSection from './invitations-section';
import AlliancesTab from './alliances-tab';

const DefensePageContent = dynamic(() => import('../../defense/_components/defense-content'), {
  loading: () => <FullPageSpinner />,
});

export enum AllianceTab {
  Create = 'create',
  Alliances = 'alliances',
  Defense = 'defense',
}

export default function AllianceContent() {
  const { locale, t } = useI18n();
  const { status } = useRequiredSession();
  const { refreshHasAlliance } = useAllianceContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { alliances, loading, refresh: refreshAlliances } = useAllianceSelector();
  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([]);
  const [hasAnyAccounts, setHasAnyAccounts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  const initialTab = (searchParams.get('tab') as AllianceTab) || AllianceTab.Alliances;
  const [activeTab, setActiveTab] = useState<AllianceTab>(
    Object.values(AllianceTab).includes(initialTab) ? initialTab : AllianceTab.Alliances
  );

  const handleDefenseStateChange = useCallback(
    (allianceId: string, bg: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', AllianceTab.Defense);
      params.set('alliance', allianceId);
      params.set('bg', String(bg));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, searchParams, router]
  );

  // Skip first render to avoid overwriting URL params on mount
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    if (activeTab !== AllianceTab.Defense) {
      params.delete('alliance');
      params.delete('bg');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab]);

  const [myInvitations, setMyInvitations] = useState<AllianceInvitation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    Record<string, AllianceInvitation[]>
  >({});

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null);
  const [memberAccountId, setMemberAccountId] = useState('');

  const [rosterTarget, setRosterTarget] = useState<{
    gameAccountId: string;
    pseudo: string;
    canRequestUpgrade: boolean;
  } | null>(null);

  const bumpRoleKey = () => setRoleRefreshKey((k) => k + 1);

  const fetchEligibleOwners = async () => {
    try {
      const data = await getEligibleOwners();
      setEligibleOwners(data);
      if (data.length > 0 && !ownerId) {
        setOwnerId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEligibleMembers = async () => {
    try {
      const data = await getEligibleMembers();
      setEligibleMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyAccounts = async () => {
    try {
      const data = await getMyGameAccounts();
      setHasAnyAccounts(data.length > 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyInvitations = async () => {
    try {
      const data = await getMyInvitations();
      setMyInvitations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingInvitations = async (allianceList: Alliance[]) => {
    const results: Record<string, AllianceInvitation[]> = {};
    try {
      const { roles } = await getMyAllianceRoles();
      const manageable = allianceList.filter((a) => roles[a.id]?.can_manage);
      await Promise.all(
        manageable.map(async (alliance) => {
          try {
            const invitations = await getAllianceInvitations(alliance.id);
            if (invitations.length > 0) {
              results[alliance.id] = invitations;
            }
          } catch {
            // ignore per-alliance fetch failure
          }
        })
      );
    } catch {
      // ignore role fetch failure
    }
    setPendingInvitations(results);
  };

  const refreshMembership = () =>
    Promise.all([
      refreshAlliances(),
      fetchEligibleOwners(),
      fetchEligibleMembers(),
      fetchMyAccounts(),
      fetchMyInvitations(),
      refreshHasAlliance(),
    ]);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([
        refreshAlliances(),
        fetchEligibleOwners(),
        fetchMyAccounts(),
        fetchMyInvitations(),
      ]);
    }
  }, [status]);

  useEffect(() => {
    if (alliances.length > 0) {
      fetchPendingInvitations(alliances);
    }
  }, [alliances]);

  useEffect(() => {
    if (!loading && activeTab === AllianceTab.Create && eligibleOwners.length === 0) {
      router.replace('/game/alliances');
    }
  }, [loading, activeTab, eligibleOwners]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim() || !ownerId) return;

    setCreating(true);
    try {
      await createAlliance(name.trim(), tag.trim(), ownerId);
      toast.success(t.game.alliances.createSuccess);
      setName('');
      setTag('');
      setOwnerId('');
      setActiveTab(AllianceTab.Alliances);
      bumpRoleKey();
      await refreshMembership();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenInviteMember = (allianceId: string) => {
    setMemberAllianceId(allianceId);
    setMemberAccountId('');
    fetchEligibleMembers();
  };

  const handleInviteMember = async (allianceId: string) => {
    if (!memberAccountId) return;
    try {
      await inviteMember(allianceId, memberAccountId);
      toast.success(t.game.alliances.inviteSuccess);
      setMemberAllianceId(null);
      setMemberAccountId('');
      await Promise.all([
        fetchEligibleMembers(),
        fetchPendingInvitations(alliances),
        fetchMyInvitations(),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.inviteError);
    }
  };

  const handleMemberRefresh = async () => {
    bumpRoleKey();
    await Promise.all([refreshAlliances(), fetchEligibleMembers(), fetchMyAccounts()]);
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId);
      toast.success(t.game.alliances.acceptInvitationSuccess);
      bumpRoleKey();
      await refreshMembership();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.acceptInvitationError);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId);
      toast.success(t.game.alliances.declineInvitationSuccess);
      await fetchMyInvitations();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.declineInvitationError);
    }
  };

  const handleCancelInvitation = async (allianceId: string, invitationId: string) => {
    try {
      await cancelInvitation(allianceId, invitationId);
      toast.success(t.game.alliances.cancelInvitationSuccess);
      setPendingInvitations((prev) => {
        const updated = { ...prev };
        if (updated[allianceId]) {
          updated[allianceId] = updated[allianceId].filter((inv) => inv.id !== invitationId);
          if (updated[allianceId].length === 0) {
            delete updated[allianceId];
          }
        }
        return updated;
      });
      await fetchEligibleMembers();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.cancelInvitationError);
    }
  };

  if (status === 'loading' || loading) {
    return <FullPageSpinner />;
  }

  const tabs: TabItem<AllianceTab>[] = [
    ...(eligibleOwners.length > 0
      ? [{ value: AllianceTab.Create, label: t.game.alliances.createTitle, cy: 'tab-create' }]
      : []),
    { value: AllianceTab.Alliances, label: t.game.alliances.title, cy: 'tab-alliances' },
    { value: AllianceTab.Defense, label: t.nav.defense, cy: 'tab-defense' },
  ];

  return (
    <AllianceRoleProvider refreshKey={roleRefreshKey}>
      <div className='w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6'>
        {myInvitations.length > 0 && (
          <InvitationsSection
            invitations={myInvitations}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
          />
        )}

        <TabBar
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === AllianceTab.Create && eligibleOwners.length > 0 && (
          <CreateAllianceForm
            hasAnyAccounts={hasAnyAccounts}
            eligibleOwners={eligibleOwners}
            name={name}
            tag={tag}
            ownerId={ownerId}
            creating={creating}
            onNameChange={setName}
            onTagChange={setTag}
            onOwnerChange={setOwnerId}
            onSubmit={handleCreate}
          />
        )}

        {activeTab === AllianceTab.Alliances && (
          <AlliancesTab
            alliances={alliances}
            locale={locale}
            memberAllianceId={memberAllianceId}
            memberAccountId={memberAccountId}
            eligibleMembers={eligibleMembers}
            pendingInvitations={pendingInvitations}
            onMemberAccountChange={setMemberAccountId}
            onOpenInviteMember={handleOpenInviteMember}
            onCloseInviteMember={() => {
              setMemberAllianceId(null);
              setMemberAccountId('');
            }}
            onInviteMember={handleInviteMember}
            onRefresh={handleMemberRefresh}
            onViewRoster={(gameAccountId, pseudo, canReq) => {
              setRosterTarget({ gameAccountId, pseudo, canRequestUpgrade: canReq });
            }}
            onCancelInvitation={handleCancelInvitation}
          />
        )}

        {activeTab === AllianceTab.Defense && (
          <DefensePageContent
            onStateChange={handleDefenseStateChange}
            initialAllianceId={searchParams.get('alliance') ?? undefined}
            initialBg={searchParams.get('bg') ? Number(searchParams.get('bg')) : undefined}
          />
        )}

        <AllianceRosterDialog
          open={!!rosterTarget}
          onOpenChange={(open) => {
            if (!open) setRosterTarget(null);
          }}
          gameAccountId={rosterTarget?.gameAccountId ?? null}
          gamePseudo={rosterTarget?.pseudo ?? ''}
          canRequestUpgrade={rosterTarget?.canRequestUpgrade ?? false}
        />
      </div>
    </AllianceRoleProvider>
  );
}
