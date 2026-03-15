'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type Alliance,
  type GameAccount,
  type AllianceInvitation,
  getMyAlliances,
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

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import { Shield, Mail, Check, X } from 'lucide-react';
import TabBar, { type TabItem } from '@/components/tab-bar';

import CreateAllianceForm from './_components/create-alliance-form';
import AllianceCard from './_components/alliance-card';
import AllianceRosterDialog from './_components/alliance-roster-dialog';

const DefensePageContent = dynamic(() => import('../defense/_components/defense-content'), {
  loading: () => <FullPageSpinner />,
});

export enum AllianceTab {
  Create = 'create',
  Alliances = 'alliances',
  Defense = 'defense',
}

function AlliancesContent() {
  const { locale, t } = useI18n();
  const { status } = useRequiredSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([]);
  const [hasAnyAccounts, setHasAnyAccounts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  // Tabs — read from URL or default
  const initialTab = (searchParams.get('tab') as AllianceTab) || AllianceTab.Alliances;
  const [activeTab, setActiveTab] = useState<AllianceTab>(
    Object.values(AllianceTab).includes(initialTab) ? initialTab : AllianceTab.Alliances
  );

  // Sync tab to URL
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

  // Invitations received by current user
  const [myInvitations, setMyInvitations] = useState<AllianceInvitation[]>([]);

  // Pending invitations sent by alliance (for officers to cancel)
  const [pendingInvitations, setPendingInvitations] = useState<
    Record<string, AllianceInvitation[]>
  >({});

  // Create form
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  // Member management
  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null);
  const [memberAccountId, setMemberAccountId] = useState('');

  // Roster viewer
  const [rosterTarget, setRosterTarget] = useState<{
    gameAccountId: string;
    pseudo: string;
    canRequestUpgrade: boolean;
  } | null>(null);

  const fetchAlliances = async () => {
    try {
      const data = await getMyAlliances();
      setAlliances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
            // ignore
          }
        })
      );
    } catch {
      // ignore role fetch failure
    }
    setPendingInvitations(results);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([
        fetchAlliances(),
        fetchEligibleOwners(),
        fetchMyAccounts(),
        fetchMyInvitations(),
      ]).then(() => {
        // createOpen stays false — will be overridden below after alliances load
      });
    }
  }, [status]);

  // Fetch pending invitations when alliances change
  useEffect(() => {
    if (alliances.length > 0) {
      fetchPendingInvitations(alliances);
    }
  }, [alliances]);

  // Redirect away from create tab if no eligible accounts after loading
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
      setRoleRefreshKey((k) => k + 1);
      await Promise.all([
        fetchAlliances(),
        fetchEligibleOwners(),
        fetchEligibleMembers(),
        fetchMyAccounts(),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  // ---- Members ----
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
      await Promise.all([fetchEligibleMembers(), fetchPendingInvitations(alliances), fetchMyInvitations()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.inviteError);
    }
  };

  const handleMemberRefresh = async () => {
    setRoleRefreshKey((k) => k + 1);
    await Promise.all([fetchAlliances(), fetchEligibleMembers(), fetchMyAccounts()]);
  };

  // ---- Invitations (accept / decline) ----
  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId);
      toast.success(t.game.alliances.acceptInvitationSuccess);
      setRoleRefreshKey((k) => k + 1);
      await Promise.all([
        fetchAlliances(),
        fetchEligibleOwners(),
        fetchEligibleMembers(),
        fetchMyAccounts(),
        fetchMyInvitations(),
      ]);
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
      // Update pending invitations locally
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
      // Refresh eligible members since cancelled invite frees up the account
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
        {/* Header */}
        <div>
          <h1 className='text-xl sm:text-2xl font-bold text-foreground'>
            {t.game.alliances.title}
          </h1>
          <p className='text-muted-foreground mt-1'>{t.game.alliances.description}</p>
        </div>

        {/* My Invitations — always visible above tabs */}
        {myInvitations.length > 0 && (
          <Card data-cy='my-invitations-section'>
            <CardContent className='py-3 sm:py-4 px-3 sm:px-6 space-y-3'>
              <div className='flex items-center gap-2'>
                <Mail className='h-5 w-5 text-blue-500' />
                <h2 className='text-sm font-medium text-muted-foreground'>
                  {t.game.alliances.myInvitations} ({myInvitations.length})
                </h2>
              </div>
              <div className='space-y-2'>
                {myInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    data-cy={`my-invitation-${inv.alliance_name}`}
                    className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-accent/50 border border-border'
                  >
                    <div className='space-y-0.5'>
                      <p className='text-sm font-medium text-foreground'>
                        {inv.alliance_name}{' '}
                        <span className='text-xs text-purple-700 font-bold'>
                          [{inv.alliance_tag}]
                        </span>
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {t.game.alliances.invitedBy} {inv.invited_by_pseudo} ·{' '}
                        {inv.game_account_pseudo}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='default'
                        data-cy='accept-invitation'
                        onClick={() => handleAcceptInvitation(inv.id)}
                      >
                        <Check className='h-3 w-3 mr-1' />
                        {t.game.alliances.acceptInvitation}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        data-cy='decline-invitation'
                        onClick={() => handleDeclineInvitation(inv.id)}
                      >
                        <X className='h-3 w-3 mr-1' />
                        {t.game.alliances.declineInvitation}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <TabBar
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Create tab */}
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

        {/* Alliances tab */}
        {activeTab === AllianceTab.Alliances && (
          <>
            {alliances.length === 0 ? (
              <Card data-cy='alliance-empty-state'>
                <CardContent className='py-12 text-center text-gray-500'>
                  <Shield className='h-12 w-12 mx-auto mb-3 text-muted-foreground' />
                  <p data-cy='alliance-empty-text'>{t.game.alliances.empty}</p>
                </CardContent>
              </Card>
            ) : (
              <div className='space-y-4'>
                {alliances.map((alliance) => (
                  <AllianceCard
                    key={alliance.id}
                    alliance={alliance}
                    locale={locale}
                    memberAllianceId={memberAllianceId}
                    memberAccountId={memberAccountId}
                    eligibleMembers={eligibleMembers}
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
                    pendingInvitations={pendingInvitations[alliance.id] ?? []}
                    onCancelInvitation={handleCancelInvitation}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Defense tab */}
        {activeTab === AllianceTab.Defense && (
          <DefensePageContent
            onStateChange={handleDefenseStateChange}
            initialAllianceId={searchParams.get('alliance') ?? undefined}
            initialBg={searchParams.get('bg') ? Number(searchParams.get('bg')) : undefined}
          />
        )}

        {/* Roster viewer dialog */}
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

export default function AlliancesPage() {
  return (
    <Suspense>
      <AlliancesContent />
    </Suspense>
  );
}
