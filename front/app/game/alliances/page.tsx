'use client';

import { useEffect, useState } from 'react';
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
  addOfficer,
  removeOfficer,
  inviteMember,
  removeMember,
  setMemberGroup,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  getAllianceInvitations,
  cancelInvitation,
} from '@/app/services/game';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { TextConfirmationDialog } from '@/components/text-confirmation-dialog';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import { Shield, Mail, Check, X } from 'lucide-react';

import CreateAllianceForm from './_components/create-alliance-form';
import AllianceCard from './_components/alliance-card';
import AllianceRosterDialog from './_components/alliance-roster-dialog';

export default function AlliancesPage() {
  const { locale, t } = useI18n();
  const { status } = useRequiredSession();

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [myAccounts, setMyAccounts] = useState<GameAccount[]>([]);
  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([]);
  const [hasAnyAccounts, setHasAnyAccounts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  // Invitations received by current user
  const [myInvitations, setMyInvitations] = useState<AllianceInvitation[]>([]);

  // Pending invitations sent by alliance (for officers to cancel)
  const [pendingInvitations, setPendingInvitations] = useState<Record<string, AllianceInvitation[]>>({});

  // Create form
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  // Member management
  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null);
  const [memberAccountId, setMemberAccountId] = useState('');

  // Exclude confirmation with text input
  const [excludeTarget, setExcludeTarget] = useState<{ allianceId: string; gameAccountId: string; pseudo: string } | null>(null);

  // Leave alliance confirmation
  const [leaveTarget, setLeaveTarget] = useState<{ allianceId: string; gameAccountId: string; pseudo: string } | null>(null);

  // Promote officer confirmation
  const [promoteTarget, setPromoteTarget] = useState<{ allianceId: string; gameAccountId: string; pseudo: string } | null>(null);

  // Roster viewer
  const [rosterTarget, setRosterTarget] = useState<{ gameAccountId: string; pseudo: string; canRequestUpgrade: boolean } | null>(null);

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
      setMyAccounts(data);
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
    await Promise.all(
      allianceList.map(async (alliance) => {
        try {
          const invitations = await getAllianceInvitations(alliance.id);
          if (invitations.length > 0) {
            results[alliance.id] = invitations;
          }
        } catch {
          // Not an officer/owner — silently ignore permission errors
        }
      }),
    );
    setPendingInvitations(results);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts(), fetchMyInvitations()]).then(() => {
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

  // Auto-open create form only if user has NO alliances yet
  useEffect(() => {
    if (!loading && alliances.length === 0) {
      setCreateOpen(true);
    }
  }, [loading, alliances.length]);

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
      setCreateOpen(false);
      setRoleRefreshKey((k) => k + 1);
      await Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  // ---- Officers (promote / demote) ----
  const handlePromoteOfficer = async (allianceId: string, gameAccountId: string) => {
    try {
      await addOfficer(allianceId, gameAccountId);
      toast.success(t.game.alliances.adjointAddSuccess);
      setPromoteTarget(null);
      setRoleRefreshKey((k) => k + 1);
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.adjointAddError);
    }
  };

  const handleDemoteOfficer = async (allianceId: string, gameAccountId: string) => {
    try {
      await removeOfficer(allianceId, gameAccountId);
      toast.success(t.game.alliances.adjointRemoveSuccess);
      setRoleRefreshKey((k) => k + 1);
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.adjointRemoveError);
    }
  };

  // ---- Members ----
  const handleOpenInviteMember = async (allianceId: string) => {
    setMemberAllianceId(allianceId);
    setMemberAccountId('');
    await fetchEligibleMembers();
  };

  const handleInviteMember = async (allianceId: string) => {
    if (!memberAccountId) return;
    try {
      await inviteMember(allianceId, memberAccountId);
      toast.success(t.game.alliances.inviteSuccess);
      setMemberAllianceId(null);
      setMemberAccountId('');
      await fetchEligibleMembers();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.inviteError);
    }
  };

  const handleRemoveMember = async (allianceId: string, gameAccountId: string) => {
    try {
      await removeMember(allianceId, gameAccountId);
      toast.success(t.game.alliances.memberRemoveSuccess);
      setExcludeTarget(null);
      setLeaveTarget(null);
      setRoleRefreshKey((k) => k + 1);
      await Promise.all([fetchAlliances(), fetchEligibleMembers(), fetchMyAccounts()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.memberRemoveError);
    }
  };

  // ---- Groups ----
  const handleSetGroup = async (allianceId: string, gameAccountId: string, group: number | null, pseudo: string) => {
    try {
      await setMemberGroup(allianceId, gameAccountId, group);
      const groupLabel = group ? `${t.game.alliances.group} ${group}` : t.game.alliances.noGroup;
      toast.success(t.game.alliances.groupSetSuccess.replace('{pseudo}', pseudo).replace('{group}', groupLabel));
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.groupSetError);
    }
  };

  // ---- Invitations (accept / decline) ----
  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId);
      toast.success(t.game.alliances.acceptInvitationSuccess);
      setRoleRefreshKey((k) => k + 1);
      await Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts(), fetchMyInvitations()]);
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
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.cancelInvitationError);
    }
  };

  if (status === 'loading' || loading) {
    return <FullPageSpinner />;
  }

  return (
    <AllianceRoleProvider refreshKey={roleRefreshKey}>
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t.game.alliances.title}</h1>
        <p className="text-gray-500 mt-1">{t.game.alliances.description}</p>
      </div>

      {/* Create form — foldable */}
      <CreateAllianceForm
        open={createOpen}
        onToggle={() => setCreateOpen((v) => !v)}
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

      {/* My Invitations */}
      {myInvitations.length > 0 && (
        <Card>
          <CardContent className="py-3 sm:py-4 px-3 sm:px-6 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <h2 className="text-sm font-medium text-gray-700">
                {t.game.alliances.myInvitations} ({myInvitations.length})
              </h2>
            </div>
            <div className="space-y-2">
              {myInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-blue-50 border border-blue-200"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {inv.alliance_name}{' '}
                      <span className="text-xs text-purple-700 font-bold">[{inv.alliance_tag}]</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.game.alliances.invitedBy} {inv.invited_by_pseudo} · {inv.game_account_pseudo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAcceptInvitation(inv.id)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {t.game.alliances.acceptInvitation}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvitation(inv.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t.game.alliances.declineInvitation}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alliance list */}
      {alliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t.game.alliances.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
              onCloseInviteMember={() => { setMemberAllianceId(null); setMemberAccountId(''); }}
              onInviteMember={handleInviteMember}
              onDemoteOfficer={handleDemoteOfficer}
              onPromoteOfficer={setPromoteTarget}
              onLeave={setLeaveTarget}
              onExclude={setExcludeTarget}
              onSetGroup={handleSetGroup}
              onViewRoster={(gameAccountId, pseudo, canReq) => {
                setRosterTarget({ gameAccountId, pseudo, canRequestUpgrade: canReq });
              }}
              pendingInvitations={pendingInvitations[alliance.id] ?? []}
              onCancelInvitation={handleCancelInvitation}
            />
          ))}
        </div>
      )}

      {/* Leave alliance confirmation */}
      <ConfirmationDialog
        open={!!leaveTarget}
        onOpenChange={(open) => { if (!open) setLeaveTarget(null); }}
        title={t.common.confirm}
        description={t.game.alliances.leaveConfirm.replace('{pseudo}', leaveTarget?.pseudo ?? '')}
        onConfirm={() => {
          if (leaveTarget) {
            handleRemoveMember(leaveTarget.allianceId, leaveTarget.gameAccountId);
          }
        }}
        variant="destructive"
        confirmText={t.game.alliances.leaveAlliance}
      />

      {/* Promote officer confirmation */}
      <ConfirmationDialog
        open={!!promoteTarget}
        onOpenChange={(open) => { if (!open) setPromoteTarget(null); }}
        title={t.common.confirm}
        description={t.game.alliances.promoteOfficerConfirm.replace('{pseudo}', promoteTarget?.pseudo ?? '')}
        onConfirm={() => {
          if (promoteTarget) {
            handlePromoteOfficer(promoteTarget.allianceId, promoteTarget.gameAccountId);
          }
        }}
        confirmText={t.game.alliances.promoteOfficer}
      />

      {/* Exclude member confirmation — requires typing "confirmer" */}
      <TextConfirmationDialog
        open={!!excludeTarget}
        onOpenChange={(open) => { if (!open) setExcludeTarget(null); }}
        title={t.common.confirm}
        description={t.game.alliances.excludeConfirm.replace('{pseudo}', excludeTarget?.pseudo ?? '')}
        onConfirm={() => {
          if (excludeTarget) {
            handleRemoveMember(excludeTarget.allianceId, excludeTarget.gameAccountId);
          }
        }}
        confirmationWord={t.game.alliances.excludeTypeConfirmPlaceholder}
        inputLabel={t.game.alliances.excludeTypeConfirm}
        confirmText={t.game.alliances.excludeMember}
        variant="destructive"
      />

      {/* Roster viewer dialog */}
      <AllianceRosterDialog
        open={!!rosterTarget}
        onOpenChange={(open) => { if (!open) setRosterTarget(null); }}
        gameAccountId={rosterTarget?.gameAccountId ?? null}
        gamePseudo={rosterTarget?.pseudo ?? ''}
        canRequestUpgrade={rosterTarget?.canRequestUpgrade ?? false}
      />
    </div>
    </AllianceRoleProvider>
  );
}
