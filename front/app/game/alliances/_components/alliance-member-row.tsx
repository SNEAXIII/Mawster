'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye } from 'lucide-react';
import { type Alliance, setMemberGroup } from '@/app/services/game';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import UsernameEnriched, { getMemberRole } from '@/components/username-enriched';
import { AllianceMemberActions } from './alliance-member-actions';

interface AllianceMember {
  id: string;
  game_pseudo: string;
  is_owner: boolean;
  is_officer: boolean;
  alliance_group: number | null;
}

interface AllianceMemberRowProps {
  member: AllianceMember;
  alliance: Alliance;
  onRefresh: () => void;
  onViewRoster: (gameAccountId: string, pseudo: string) => void;
}

export default function AllianceMemberRow({
  member,
  alliance,
  onRefresh,
  onViewRoster,
}: AllianceMemberRowProps) {
  const { t } = useI18n();
  const { isMine: isMineCheck, canManage } = useAllianceRole();

  const memberIsMine = isMineCheck(member.id);
  const userCanManage = canManage(alliance);
  const allianceId = alliance.id;

  const [isChangingGroup, setIsChangingGroup] = useState(false);

  const MAX_PER_GROUP = 10;
  const groupCounts = alliance.members.reduce<Record<number, number>>((acc, m) => {
    if (m.alliance_group !== null) acc[m.alliance_group] = (acc[m.alliance_group] ?? 0) + 1;
    return acc;
  }, {});
  const isGroupFull = (g: number) =>
    (groupCounts[g] ?? 0) >= MAX_PER_GROUP && member.alliance_group !== g;

  const handleSetGroup = async (val: string) => {
    const group = val === 'none' ? null : parseInt(val);
    setIsChangingGroup(true);
    try {
      await setMemberGroup(allianceId, member.id, group);
      const groupLabel = group
        ? `${t.game.alliances.group} ${group}`
        : t.game.alliances.noGroup;
      toast.success(
        t.game.alliances.groupSetSuccess
          .replace('{pseudo}', member.game_pseudo)
          .replace('{group}', groupLabel)
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || t.game.alliances.groupSetError);
    } finally {
      setIsChangingGroup(false);
    }
  };

  return (
    <div
      className='flex flex-col py-2 px-2 rounded hover:bg-accent/50 gap-1'
      data-cy={`member-row-${member.game_pseudo}`}
    >
      <div className='flex items-center gap-0.5 flex-wrap'>
        <div className='min-w-0 max-w-full'>
          <UsernameEnriched
            pseudo={member.game_pseudo}
            role={getMemberRole(member.is_owner, member.is_officer)}
            isMine={memberIsMine}
          />
        </div>

        <div className='flex items-center gap-0.5 shrink-0'>
          {/* View Roster */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent'
                  data-cy={`view-roster-${member.game_pseudo}`}
                  onClick={() => onViewRoster(member.id, member.game_pseudo)}
                >
                  <Eye className='h-3.5 w-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.game.alliances.viewRoster}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Actions dropdown (promote / demote / leave / exclude) */}
          <AllianceMemberActions member={member} alliance={alliance} onRefresh={onRefresh} />

          {/* Group selector — only for officers/owners */}
          {userCanManage && (
            <Select
              value={member.alliance_group?.toString() ?? 'none'}
              onValueChange={handleSetGroup}
              disabled={isChangingGroup}
            >
              <SelectTrigger
                className='h-4 w-10 text-[8px] px-0.5'
                data-cy='member-group-select'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>{t.game.alliances.noGroup}</SelectItem>
                {!isGroupFull(1) && <SelectItem value='1'>G1</SelectItem>}
                {!isGroupFull(2) && <SelectItem value='2'>G2</SelectItem>}
                {!isGroupFull(3) && <SelectItem value='3'>G3</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
