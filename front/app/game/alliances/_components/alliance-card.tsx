'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Crown,
  UserPlus,
  Users,
  Mail,
  X,
} from 'lucide-react';
import { type Alliance, type GameAccount, type AllianceInvitation } from '@/app/services/game';
import { formatDateMedium } from '@/app/lib/utils';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import AllianceMemberRow from './alliance-member-row';

interface ConfirmTarget {
  allianceId: string;
  gameAccountId: string;
  pseudo: string;
}

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
  onDemoteOfficer: (allianceId: string, gameAccountId: string) => void;
  onPromoteOfficer: (target: ConfirmTarget) => void;
  onLeave: (target: ConfirmTarget) => void;
  onExclude: (target: ConfirmTarget) => void;
  onSetGroup: (allianceId: string, gameAccountId: string, group: number | null, pseudo: string) => void;
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
  onDemoteOfficer,
  onPromoteOfficer,
  onLeave,
  onExclude,
  onSetGroup,
  onViewRoster,
  pendingInvitations = [],
  onCancelInvitation,
}: AllianceCardProps) {
  const { t } = useI18n();
  const { isMine, isOwner, canManage } = useAllianceRole();
  const userIsOwner = isOwner(alliance);
  const userCanManage = canManage(alliance);
  const officerCount = alliance.officers.length;

  const sortedMembers = [...alliance.members].sort((a, b) => {
    const rank = (m: typeof a) => (m.is_owner ? 0 : m.is_officer ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <Card>
        <CardContent className="py-3 sm:py-4 px-3 sm:px-6 space-y-3 sm:space-y-4">
        {/* Alliance header */}
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-purple-500" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900">{alliance.name}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                [{alliance.tag}]
              </span>
              <span className="text-xs text-gray-400">
                {alliance.member_count} {t.game.alliances.members} · {officerCount}{' '}
                {t.game.alliances.officersCount}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Crown className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-gray-600">{alliance.owner_pseudo}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">
                {formatDateMedium(alliance.created_at, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Members section */}
        <div className="border-t pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {t.game.alliances.membersTitle} ({alliance.member_count})
              </span>
            </div>

            {/* Invite member button / inline form */}
            {userCanManage &&
              (memberAllianceId === alliance.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={memberAccountId} onValueChange={onMemberAccountChange}>
                    <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                      <SelectValue placeholder={t.game.alliances.selectMember} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleMembers.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.game_pseudo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!memberAccountId}
                    onClick={() => onInviteMember(alliance.id)}
                  >
                    {t.game.alliances.inviteMemberButton}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCloseInviteMember}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenInviteMember(alliance.id)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {t.game.alliances.inviteMember}
                </Button>
              ))}
          </div>

          {alliance.members.length > 0 && (
            <div className="space-y-1">
              {sortedMembers.map((member) => (
                <AllianceMemberRow
                  key={member.id}
                  member={member}
                  alliance={alliance}
                  onDemoteOfficer={onDemoteOfficer}
                  onPromoteOfficer={onPromoteOfficer}
                  onLeave={onLeave}
                  onExclude={onExclude}
                  onSetGroup={onSetGroup}
                  onViewRoster={(gameAccountId, pseudo) =>
                    onViewRoster(gameAccountId, pseudo, userCanManage)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Pending invitations section (visible to officers/owners) */}
        {userCanManage && pendingInvitations.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">
                {t.game.alliances.pendingInvitations} ({pendingInvitations.length})
              </span>
            </div>
            <div className="space-y-1">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-amber-50 border border-amber-200"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-gray-900">{inv.game_account_pseudo}</p>
                    <p className="text-xs text-gray-500">
                      {t.game.alliances.invitedBy} {inv.invited_by_pseudo}
                    </p>
                  </div>
                  {onCancelInvitation && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onCancelInvitation(alliance.id, inv.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t.game.alliances.cancelInvitation}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
