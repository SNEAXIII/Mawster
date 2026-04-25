'use client';

import React, { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, UserPlus, Users, X, Pencil, Check } from 'lucide-react';
import InviteMemberCombo from './alliance-invite-member-combo';
import { type Alliance, type GameAccount, type AllianceInvitation } from '@/app/services/game';
import { formatDateMedium } from '@/app/lib/utils';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { CollapsibleSection } from '@/components/collapsible-section';
import AllianceMemberRow from './alliance-member-row';
import UsernameEnriched from '@/components/username-enriched';
import { patchAllianceElo, patchAllianceTier } from '@/app/services/game';
import { toast } from 'sonner';

interface AllianceCardProps {
  alliance: Alliance;
  locale: string;
  /** Currently open invite-member form alliance id */
  memberAllianceId: string | null;
  memberAccountId: string;
  eligibleMembers: GameAccount[];
  onMemberAccountChange: (value: string) => void;
  onOpenInviteMember: (allianceId: string) => void;
  onCloseInviteMember: () => void;
  onInviteMember: (allianceId: string) => void;
  onRefresh: () => Promise<void>;
  onViewRoster: (gameAccountId: string, pseudo: string, canRequestUpgrade: boolean) => void;
  pendingInvitations?: AllianceInvitation[];
  onCancelInvitation?: (allianceId: string, invitationId: string) => void;
}

export default function AllianceCard({
  alliance,
  locale,
  memberAllianceId,
  memberAccountId,
  eligibleMembers,
  onMemberAccountChange,
  onOpenInviteMember,
  onCloseInviteMember,
  onInviteMember,
  onRefresh,
  onViewRoster,
  pendingInvitations = [],
  onCancelInvitation,
}: Readonly<AllianceCardProps>) {
  const { t } = useI18n();
  const { canManage } = useAllianceRole();
  const userCanManage = canManage(alliance);
  const officerCount = alliance.officers.length;
  const [editingElo, setEditingElo] = useState(false);
  const [editingTier, setEditingTier] = useState(false);
  const [eloDraft, setEloDraft] = useState('');
  const [tierDraft, setTierDraft] = useState('');

  function startEditElo() {
    setEloDraft(String(alliance.elo));
    setEditingElo(true);
  }

  async function saveElo() {
    const val = Number(eloDraft);
    if (!Number.isNaN(val) && val >= 0 && val <= 4500) {
      try {
        await patchAllianceElo(alliance.id, val);
        await onRefresh();
        toast.success(t.game.war.eloUpdateSuccess);
      } catch (err: unknown) {
        toast.error((err as Error).message || t.game.war.eloUpdateError);
      }
    }
    setEditingElo(false);
  }

  function startEditTier() {
    setTierDraft(String(alliance.tier));
    setEditingTier(true);
  }

  async function saveTier() {
    const val = Number(tierDraft);
    if (!Number.isNaN(val) && val >= 1 && val <= 20) {
      try {
        await patchAllianceTier(alliance.id, val);
        await onRefresh();
        toast.success(t.game.war.tierUpdateSuccess);
      } catch (err: unknown) {
        toast.error((err as Error).message || t.game.war.tierUpdateError);
      }
    }
    setEditingTier(false);
  }

  const GROUPS = [1, 2, 3, null] as const;
  const membersByGroup = GROUPS.map((group) => ({
    group,
    members: [...alliance.members]
      .filter((m) => m.alliance_group === group)
      .sort((a, b) => {
        const rank = (m: typeof a) => {
          if (m.is_owner) return 0;
          if (m.is_officer) return 1;
          return 2;
        };
        return rank(a) - rank(b);
      }),
  }));

  return (
    <Card data-cy={`alliance-card-${alliance.name}`}>
      <CardContent className='py-3 sm:py-4 px-3 sm:px-6 space-y-3 sm:space-y-4'>
        {/* Alliance header */}
        <div className='flex items-center gap-3'>
          <Shield className='h-5 w-5 text-purple-500' />
          <div>
            <div className='flex items-center gap-2 flex-wrap'>
              <p
                className='font-medium text-foreground'
                data-cy='alliance-name'
              >
                {alliance.name}
              </p>
              <span
                className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800'
                data-cy='alliance-tag'
              >
                [{alliance.tag}]
              </span>
              <span
                className='text-xs text-muted-foreground'
                data-cy='alliance-officer-count'
              >
                {officerCount} {t.game.alliances.officersCount}
              </span>
            </div>
            <div className='flex items-center gap-2 mt-1'>
              <UsernameEnriched
                pseudo={alliance.owner_pseudo}
                role='owner'
                textSize='text-xs'
              />
              <span className='text-xs text-muted-foreground'>·</span>
              <span className='text-xs text-muted-foreground'>
                {formatDateMedium(alliance.created_at, locale)}
              </span>
            </div>
            <div className='flex items-center gap-2 mt-1 flex-wrap'>
              <span
                className='text-xs text-muted-foreground'
                data-cy='alliance-elo'
              >
                {editingElo ? (
                  <span className='inline-flex items-center gap-1'>
                    <span>{t.game.alliances.elo}:</span>
                    <Input
                      type='number'
                      className='h-7 w-24 text-xs'
                      value={eloDraft}
                      onChange={(e) => setEloDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveElo();
                        if (e.key === 'Escape') setEditingElo(false);
                      }}
                      autoFocus
                      data-cy='alliance-elo-input'
                    />
                    <button
                      onClick={() => void saveElo()}
                      className='text-green-600 hover:text-green-700'
                      data-cy='alliance-elo-save'
                    >
                      <Check className='w-3.5 h-3.5' />
                    </button>
                    <button
                      onClick={() => setEditingElo(false)}
                      className='text-muted-foreground hover:text-foreground'
                    >
                      <X className='w-3.5 h-3.5' />
                    </button>
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1'>
                    <span>{t.game.alliances.elo}:</span>
                    <span className='font-semibold text-foreground'>{alliance.elo}</span>
                    {userCanManage && (
                      <button
                        onClick={startEditElo}
                        className='text-muted-foreground hover:text-foreground'
                        data-cy='alliance-elo-edit'
                      >
                        <Pencil className='w-3 h-3' />
                      </button>
                    )}
                  </span>
                )}
              </span>
              <span className='text-xs text-muted-foreground'>·</span>
              <span
                className='text-xs text-muted-foreground'
                data-cy='alliance-tier'
              >
                {editingTier ? (
                  <span className='inline-flex items-center gap-1'>
                    <span>{t.game.alliances.tier}:</span>
                    <Input
                      type='number'
                      className='h-7 w-20 text-xs'
                      value={tierDraft}
                      onChange={(e) => setTierDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveTier();
                        if (e.key === 'Escape') setEditingTier(false);
                      }}
                      autoFocus
                      data-cy='alliance-tier-input'
                    />
                    <button
                      onClick={() => void saveTier()}
                      className='text-green-600 hover:text-green-700'
                      data-cy='alliance-tier-save'
                    >
                      <Check className='w-3.5 h-3.5' />
                    </button>
                    <button
                      onClick={() => setEditingTier(false)}
                      className='text-muted-foreground hover:text-foreground'
                    >
                      <X className='w-3.5 h-3.5' />
                    </button>
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1'>
                    <span>{t.game.alliances.tier}:</span>
                    <span className='font-semibold text-foreground'>{alliance.tier}</span>
                    {userCanManage && (
                      <button
                        onClick={startEditTier}
                        className='text-muted-foreground hover:text-foreground'
                        data-cy='alliance-tier-edit'
                      >
                        <Pencil className='w-3 h-3' />
                      </button>
                    )}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Pending invitations section — above members, collapsible (visible to officers/owners) */}
        {userCanManage && pendingInvitations.length > 0 && (
          <CollapsibleSection
            title={`${t.game.alliances.pendingInvitations} (${pendingInvitations.length})`}
            defaultOpen={true}
            className='border-amber-200'
          >
            <div className='space-y-1'>
              {pendingInvitations.map((inv, index) => (
                <div
                  key={inv.id}
                  data-cy={`pending-invitation-${index}`}
                  className='flex items-center justify-between gap-2 p-2 rounded-md bg-amber-50 border border-amber-200'
                >
                  <div className='space-y-0.5'>
                    <p className='text-sm text-black'>{inv.game_account_pseudo}</p>
                    <p className='text-xs text-black/60'>
                      {t.game.alliances.invitedBy} {inv.invited_by_pseudo}
                    </p>
                  </div>
                  {onCancelInvitation && (
                    <Button
                      size='sm'
                      variant='ghost'
                      className='text-red-500 hover:text-red-700 hover:bg-red-50'
                      onClick={() => onCancelInvitation(alliance.id, inv.id)}
                    >
                      <X className='h-3 w-3 mr-1' />
                      {t.game.alliances.cancelInvitation}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Members section */}
        <div className='border-t pt-3'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2'>
            <div className='flex items-center gap-2'>
              <Users className='h-4 w-4 text-green-500' />
              <span
                data-cy='alliance-member-count'
                className='text-sm font-medium text-muted-foreground'
              >
                {t.game.alliances.membersTitle} ({alliance.member_count})
              </span>
            </div>

            {/* Invite member button / inline form */}
            {userCanManage &&
              (memberAllianceId === alliance.id ? (
                <div className='flex flex-wrap items-center gap-2'>
                  <InviteMemberCombo
                    eligibleMembers={eligibleMembers}
                    memberAccountId={memberAccountId}
                    onMemberAccountChange={onMemberAccountChange}
                  />
                  <Button
                    size='sm'
                    disabled={!memberAccountId}
                    data-cy='invite-member-submit'
                    onClick={() => onInviteMember(alliance.id)}
                  >
                    {t.game.alliances.inviteMemberButton}
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    data-cy='invite-member-cancel'
                    onClick={onCloseInviteMember}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <Button
                  size='sm'
                  variant='outline'
                  data-cy='invite-member-toggle'
                  onClick={() => onOpenInviteMember(alliance.id)}
                >
                  <UserPlus className='h-3 w-3 mr-1' />
                  {t.game.alliances.inviteMember}
                </Button>
              ))}
          </div>

          {alliance.members.length > 0 && (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-1'>
              {membersByGroup.map(({ group, members }) => (
                <div
                  key={group ?? 'unassigned'}
                  data-cy={`group-col-${group ?? 'unassigned'}`}
                >
                  <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 mb-1 border-b'>
                    {group === null
                      ? t.game.alliances.noGroup
                      : `${t.game.alliances.group} ${group}`}
                    {members.length > 0 && (
                      <span className='ml-1 font-normal'>({members.length})</span>
                    )}
                  </p>
                  {members.length === 0 ? (
                    <p className='text-xs text-muted-foreground italic py-1'>—</p>
                  ) : (
                    <div className='space-y-0.5'>
                      {members.map((member) => (
                        <AllianceMemberRow
                          key={member.id}
                          member={member}
                          alliance={alliance}
                          onRefresh={onRefresh}
                          onViewRoster={(gameAccountId, pseudo) =>
                            onViewRoster(gameAccountId, pseudo, userCanManage)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
