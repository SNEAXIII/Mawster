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
} from 'lucide-react';
import { type Alliance, type GameAccount } from '@/app/services/game';
import { formatDateMedium } from '@/app/lib/utils';
import AllianceMemberRow from './alliance-member-row';

interface ConfirmTarget {
  allianceId: string;
  gameAccountId: string;
  pseudo: string;
}

interface AllianceCardProps {
  alliance: Alliance;
  locale: string;
  myAccountIds: Set<string>;
  isOwner: boolean;
  canManage: boolean;
  /** Currently open add-member form alliance id */
  memberAllianceId: string | null;
  memberAccountId: string;
  eligibleMembers: GameAccount[];
  onMemberAccountChange: (value: string) => void;
  onOpenAddMember: (allianceId: string) => void;
  onCloseAddMember: () => void;
  onAddMember: (allianceId: string) => void;
  onDemoteOfficer: (allianceId: string, gameAccountId: string) => void;
  onPromoteOfficer: (target: ConfirmTarget) => void;
  onLeave: (target: ConfirmTarget) => void;
  onExclude: (target: ConfirmTarget) => void;
  onSetGroup: (allianceId: string, gameAccountId: string, group: number | null, pseudo: string) => void;
}

export default function AllianceCard({
  alliance,
  locale,
  myAccountIds,
  isOwner,
  canManage,
  memberAllianceId,
  memberAccountId,
  eligibleMembers,
  onMemberAccountChange,
  onOpenAddMember,
  onCloseAddMember,
  onAddMember,
  onDemoteOfficer,
  onPromoteOfficer,
  onLeave,
  onExclude,
  onSetGroup,
}: AllianceCardProps) {
  const { t } = useI18n();
  const officerCount = alliance.officers.length;

  const sortedMembers = [...alliance.members].sort((a, b) => {
    const rank = (m: typeof a) => (m.is_owner ? 0 : m.is_officer ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {t.game.alliances.membersTitle} ({alliance.member_count})
              </span>
            </div>

            {/* Add member button / inline form */}
            {canManage &&
              (memberAllianceId === alliance.id ? (
                <div className="flex items-center gap-2">
                  <Select value={memberAccountId} onValueChange={onMemberAccountChange}>
                    <SelectTrigger className="w-48 h-8 text-xs">
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
                    onClick={() => onAddMember(alliance.id)}
                  >
                    {t.game.alliances.addMemberButton}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCloseAddMember}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenAddMember(alliance.id)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {t.game.alliances.addMember}
                </Button>
              ))}
          </div>

          {alliance.members.length > 0 && (
            <div className="space-y-1">
              {sortedMembers.map((member) => (
                <AllianceMemberRow
                  key={member.id}
                  member={member}
                  allianceId={alliance.id}
                  isMine={myAccountIds.has(member.id)}
                  userIsOwner={isOwner}
                  userCanManage={canManage}
                  onDemoteOfficer={onDemoteOfficer}
                  onPromoteOfficer={onPromoteOfficer}
                  onLeave={onLeave}
                  onExclude={onExclude}
                  onSetGroup={onSetGroup}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
