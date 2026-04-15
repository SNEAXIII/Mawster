'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useRequiredSession } from '@/hooks/use-required-session';
import { useAllianceContext } from '@/app/contexts/alliance-context';

export enum AllianceTab {
  Create = 'create',
  Alliances = 'alliances',
  Defense = 'defense',
}

export function useAlliancesViewModel() {
  const { locale, t } = useI18n();
  const { status } = useRequiredSession();
  const { alliances, loading, refresh: refreshAlliances } = useAllianceContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

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

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    if (activeTab !== AllianceTab.Defense) {
      params.delete('alliance');
      params.delete('bg');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [myInvitations, setMyInvitations] = useState<AllianceInvitation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Record<string, AllianceInvitation[]>>({});

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
      if (data.length > 0 && !ownerId) setOwnerId(data[0].id);
    } catch (err) { console.error(err); }
  };

  const fetchEligibleMembers = async () => {
    try { setEligibleMembers(await getEligibleMembers()); }
    catch (err) { console.error(err); }
  };

  const fetchMyAccounts = async () => {
    try {
      const data = await getMyGameAccounts();
      setHasAnyAccounts(data.length > 0);
    } catch (err) { console.error(err); }
  };

  const fetchMyInvitations = async () => {
    try { setMyInvitations(await getMyInvitations()); }
    catch (err) { console.error(err); }
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
            if (invitations.length > 0) results[alliance.id] = invitations;
          } catch { /* ignore per-alliance fetch failure */ }
        })
      );
    } catch { /* ignore role fetch failure */ }
    setPendingInvitations(results);
  };

  const refreshMembership = () =>
    Promise.all([refreshAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts(), fetchMyInvitations()]);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([refreshAlliances(), fetchEligibleOwners(), fetchMyAccounts(), fetchMyInvitations()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (alliances.length > 0) fetchPendingInvitations(alliances);
  }, [alliances]);

  useEffect(() => {
    if (!loading && activeTab === AllianceTab.Create && eligibleOwners.length === 0) {
      router.replace('/game/alliances');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeTab, eligibleOwners]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim() || !ownerId) return;
    setCreating(true);
    try {
      await createAlliance(name.trim(), tag.trim(), ownerId);
      toast.success(t.game.alliances.createSuccess);
      setName(''); setTag(''); setOwnerId('');
      setActiveTab(AllianceTab.Alliances);
      bumpRoleKey();
      await refreshMembership();
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || t.game.alliances.createError);
    } finally { setCreating(false); }
  };

  const handleOpenInviteMember = (allianceId: string) => {
    setMemberAllianceId(allianceId);
    setMemberAccountId('');
    fetchEligibleMembers();
  };

  const handleCloseInviteMember = () => { setMemberAllianceId(null); setMemberAccountId(''); };

  const handleInviteMember = async (allianceId: string) => {
    if (!memberAccountId) return;
    try {
      await inviteMember(allianceId, memberAccountId);
      toast.success(t.game.alliances.inviteSuccess);
      setMemberAllianceId(null); setMemberAccountId('');
      await Promise.all([fetchEligibleMembers(), fetchPendingInvitations(alliances), fetchMyInvitations()]);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || t.game.alliances.inviteError);
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
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || t.game.alliances.acceptInvitationError);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId);
      toast.success(t.game.alliances.declineInvitationSuccess);
      await fetchMyInvitations();
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || t.game.alliances.declineInvitationError);
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
          if (updated[allianceId].length === 0) delete updated[allianceId];
        }
        return updated;
      });
      await fetchEligibleMembers();
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || t.game.alliances.cancelInvitationError);
    }
  };

  return {
    locale,
    status,
    alliances,
    loading,
    eligibleOwners,
    eligibleMembers,
    hasAnyAccounts,
    creating,
    roleRefreshKey,
    activeTab,
    myInvitations,
    pendingInvitations,
    name,
    tag,
    ownerId,
    memberAllianceId,
    memberAccountId,
    rosterTarget,
    searchParams,
    setActiveTab,
    setName,
    setTag,
    setOwnerId,
    setMemberAccountId,
    setRosterTarget,
    handleCreate,
    handleOpenInviteMember,
    handleCloseInviteMember,
    handleInviteMember,
    handleMemberRefresh,
    handleAcceptInvitation,
    handleDeclineInvitation,
    handleCancelInvitation,
    handleDefenseStateChange,
  };
}
