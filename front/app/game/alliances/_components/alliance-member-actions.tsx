'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { TextConfirmationDialog } from '@/components/text-confirmation-dialog';
import { MoreHorizontal, ShieldCheck, ShieldMinus, UserMinus } from 'lucide-react';
import { type Alliance, addOfficer, removeOfficer, removeMember } from '@/app/services/game';
import { useAllianceRole } from '@/hooks/use-alliance-role';

const AllianceMemberAction = {
  PROMOTE: 'promote',
  DEMOTE: 'demote',
  REMOVE: 'remove',
  LEAVE: 'leave',
} as const;

type AllianceMemberAction = (typeof AllianceMemberAction)[keyof typeof AllianceMemberAction];

interface AllianceMember {
  id: string;
  game_pseudo: string;
  is_owner: boolean;
  is_officer: boolean;
}

interface AllianceMemberActionsProps {
  member: AllianceMember;
  alliance: Alliance;
  onRefresh: () => void;
}

export function AllianceMemberActions({ member, alliance, onRefresh }: AllianceMemberActionsProps) {
  const { t } = useI18n();
  const { isMine: isMineCheck, isOwner, canManage } = useAllianceRole();

  const memberIsMine = isMineCheck(member.id);
  const userIsOwner = isOwner(alliance);
  const userCanManage = canManage(alliance);
  const allianceId = alliance.id;

  const [isLoading, setIsLoading] = useState<Record<AllianceMemberAction, boolean>>({
    promote: false,
    demote: false,
    remove: false,
    leave: false,
  });
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isExcludeDialogOpen, setIsExcludeDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  const handleAction = async (action: AllianceMemberAction) => {
    setIsLoading((prev) => ({ ...prev, [action]: true }));
    try {
      switch (action) {
        case AllianceMemberAction.PROMOTE:
          await addOfficer(allianceId, member.id);
          toast.success(t.game.alliances.officerAddSuccess);
          setIsPromoteDialogOpen(false);
          break;
        case AllianceMemberAction.DEMOTE:
          await removeOfficer(allianceId, member.id);
          toast.success(t.game.alliances.officerRemoveSuccess);
          break;
        case AllianceMemberAction.REMOVE:
          await removeMember(allianceId, member.id);
          toast.success(t.game.alliances.memberRemoveSuccess);
          setIsExcludeDialogOpen(false);
          break;
        case AllianceMemberAction.LEAVE:
          await removeMember(allianceId, member.id);
          toast.success(t.game.alliances.memberRemoveSuccess);
          setIsLeaveDialogOpen(false);
          break;
      }
      onRefresh();
    } catch (err: any) {
      console.error(err);
      const errorMsg =
        action === AllianceMemberAction.PROMOTE
          ? t.game.alliances.officerAddError
          : action === AllianceMemberAction.DEMOTE
            ? t.game.alliances.officerRemoveError
            : t.game.alliances.memberRemoveError;
      toast.error(err?.message || errorMsg);
    } finally {
      setIsLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  const canPromote = userIsOwner && !member.is_owner && !member.is_officer;
  const canDemote = userIsOwner && !member.is_owner && member.is_officer;
  const canLeave = !member.is_owner && memberIsMine;
  const canExclude = !member.is_owner && !memberIsMine && userCanManage;

  if (!canPromote && !canDemote && !canLeave && !canExclude) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent'
            data-cy={`member-actions-${member.game_pseudo}`}
          >
            <MoreHorizontal className='h-3.5 w-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {canPromote && (
            <DropdownMenuItem
              onClick={() => setIsPromoteDialogOpen(true)}
              className='text-blue-600 flex items-center'
              disabled={isLoading.promote}
              data-cy={`promote-officer-${member.game_pseudo}`}
            >
              <ShieldCheck className='mr-2 h-4 w-4' />
              {t.game.alliances.promoteOfficer}
            </DropdownMenuItem>
          )}
          {canDemote && (
            <DropdownMenuItem
              onClick={() => handleAction(AllianceMemberAction.DEMOTE)}
              className='text-orange-600 flex items-center'
              disabled={isLoading.demote}
              data-cy={`demote-officer-${member.game_pseudo}`}
            >
              <ShieldMinus className='mr-2 h-4 w-4' />
              {t.game.alliances.demoteOfficer}
            </DropdownMenuItem>
          )}
          {canLeave && (
            <DropdownMenuItem
              onClick={() => setIsLeaveDialogOpen(true)}
              className='flex items-center'
              disabled={isLoading.leave}
              data-cy={`leave-alliance-${member.game_pseudo}`}
            >
              <UserMinus className='mr-2 h-4 w-4' />
              {t.game.alliances.leaveAlliance}
            </DropdownMenuItem>
          )}
          {canExclude && (
            <DropdownMenuItem
              onClick={() => setIsExcludeDialogOpen(true)}
              className='text-red-600 flex items-center'
              disabled={isLoading.remove}
              data-cy={`exclude-member-${member.game_pseudo}`}
            >
              <UserMinus className='mr-2 h-4 w-4' />
              {t.game.alliances.excludeMember}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={isPromoteDialogOpen}
        onOpenChange={setIsPromoteDialogOpen}
        title={t.common.confirm}
        description={t.game.alliances.promoteOfficerConfirm.replace('{pseudo}', member.game_pseudo)}
        onConfirm={() => handleAction(AllianceMemberAction.PROMOTE)}
        confirmText={t.game.alliances.promoteOfficer}
      />

      <ConfirmationDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        title={t.common.confirm}
        description={t.game.alliances.leaveConfirm.replace('{pseudo}', member.game_pseudo)}
        onConfirm={() => handleAction(AllianceMemberAction.LEAVE)}
        variant='destructive'
        confirmText={t.game.alliances.leaveAlliance}
      />

      <TextConfirmationDialog
        open={isExcludeDialogOpen}
        onOpenChange={setIsExcludeDialogOpen}
        title={t.common.confirm}
        description={t.game.alliances.excludeConfirm.replace('{pseudo}', member.game_pseudo)}
        onConfirm={() => handleAction(AllianceMemberAction.REMOVE)}
        confirmationWord={t.game.alliances.excludeTypeConfirmPlaceholder}
        inputLabel={t.game.alliances.excludeTypeConfirm}
        confirmText={t.game.alliances.excludeMember}
        variant='destructive'
      />
    </>
  );
}
