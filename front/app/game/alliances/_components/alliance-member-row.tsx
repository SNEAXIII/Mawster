'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Crown,
  UserMinus,
  ShieldCheck,
  ShieldMinus,
} from 'lucide-react';

const GROUP_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
};

interface AllianceMember {
  id: string;
  game_pseudo: string;
  is_owner: boolean;
  is_officer: boolean;
  alliance_group: number | null;
}

interface AllianceMemberRowProps {
  member: AllianceMember;
  allianceId: string;
  isMine: boolean;
  userIsOwner: boolean;
  userCanManage: boolean;
  onDemoteOfficer: (allianceId: string, gameAccountId: string) => void;
  onPromoteOfficer: (target: { allianceId: string; gameAccountId: string; pseudo: string }) => void;
  onLeave: (target: { allianceId: string; gameAccountId: string; pseudo: string }) => void;
  onExclude: (target: { allianceId: string; gameAccountId: string; pseudo: string }) => void;
  onSetGroup: (allianceId: string, gameAccountId: string, group: number | null, pseudo: string) => void;
}

export default function AllianceMemberRow({
  member,
  allianceId,
  isMine,
  userIsOwner,
  userCanManage,
  onDemoteOfficer,
  onPromoteOfficer,
  onLeave,
  onExclude,
  onSetGroup,
}: AllianceMemberRowProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-800">{member.game_pseudo}</span>
        {member.is_owner && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
            <Crown className="h-2.5 w-2.5" /> {t.game.alliances.owner}
          </span>
        )}
        {member.is_officer && !member.is_owner && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
            Officer
          </span>
        )}
        {member.alliance_group ? (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${GROUP_COLORS[member.alliance_group]}`}
          >
            {t.game.alliances.group} {member.alliance_group}
          </span>
        ) : null}
        {isMine && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
            {t.game.alliances.you}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Promote / Demote — owner only, not on self/owner */}
        {userIsOwner && !member.is_owner && (
          member.is_officer ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                    onClick={() => onDemoteOfficer(allianceId, member.id)}
                  >
                    <ShieldMinus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.game.alliances.demoteOfficer}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() =>
                      onPromoteOfficer({
                        allianceId,
                        gameAccountId: member.id,
                        pseudo: member.game_pseudo,
                      })
                    }
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.game.alliances.promoteOfficer}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        )}

        {/* Leave (own account) or Exclude (officer/owner action on others) */}
        {!member.is_owner && (
          isMine ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    onClick={() =>
                      onLeave({
                        allianceId,
                        gameAccountId: member.id,
                        pseudo: member.game_pseudo,
                      })
                    }
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.game.alliances.leaveAlliance}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : userCanManage ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() =>
                      onExclude({
                        allianceId,
                        gameAccountId: member.id,
                        pseudo: member.game_pseudo,
                      })
                    }
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.game.alliances.excludeMember}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null
        )}

        {/* Group selector */}
        <Select
          value={member.alliance_group?.toString() ?? 'none'}
          onValueChange={(val) =>
            onSetGroup(
              allianceId,
              member.id,
              val === 'none' ? null : parseInt(val),
              member.game_pseudo,
            )
          }
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.game.alliances.noGroup}</SelectItem>
            <SelectItem value="1">{t.game.alliances.group} 1</SelectItem>
            <SelectItem value="2">{t.game.alliances.group} 2</SelectItem>
            <SelectItem value="3">{t.game.alliances.group} 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
