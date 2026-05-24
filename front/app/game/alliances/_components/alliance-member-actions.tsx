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
import { Crown, MoreHorizontal, ShieldCheck, ShieldMinus, UserMinus } from 'lucide-react';
import {
  type Alliance,
  addOfficer,
  removeOfficer,
  removeMember,
  transferOwnership,
} from '@/app/services/game';
import { useAllianceRole } from '@/hooks/use-alliance-role';

const AllianceMemberAction = {
  PROMOTE: 'promote',
  DEMOTE: 'demote',
  REMOVE: 'remove',
  LEAVE: 'leave',
  TRANSFER_OWNER: 'transfer_owner',
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
    transfer_owner: false,
  });
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isExcludeDialogOpen, setIsExcludeDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

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
        case AllianceMemberAction.TRANSFER_OWNER:
          await transferOwnership(allianceId, member.id);
          toast.success(
            t.game.alliances.transferOwnerSuccess.replace('{pseudo}', member.game_pseudo),
          );
          setIsTransferDialogOpen(false);
          break;
      }
      onRefresh();
    } catch (err: unknown) {
      console.error(err);
      const errorMsg =
        action === AllianceMemberAction.PROMOTE
          ? t.game.alliances.officerAddError
          : action === AllianceMemberAction.DEMOTE
            ? t.game.alliances.officerRemoveError
            : action === AllianceMemberAction.TRANSFER_OWNER
              ? t.game.alliances.transferOwnerError
              : t.game.alliances.memberRemoveError;
      const errMessage = err instanceof Error ? err.message : undefined;
      toast.error(errMessage || errorMsg);
    } finally {
      setIsLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  const canPromote = userIsOwner && !member.is_owner && !member.is_officer;
  const canDemote = userIsOwner && !member.is_owner && member.is_officer;
  const canLeave = !member.is_owner && memberIsMine;
  const canExclude = !member.is_owner && !memberIsMine && userCanManage;
  const canTransferOwner = userIsOwner && member.is_officer && !member.is_owner;

  if (!canPromote && !canDemote && !canLeave && !canExclude && !canTransferOwner) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='size-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent'
            data-cy={`member-actions-${member.game_pseudo}`}
          >
            <MoreHorizontal className='size-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {canPromote && (
            <DropdownMenuItem
              onClick={() => setIsPromoteDialogOpen(true)}
              className='text-primary flex items-center'
              disabled={isLoading.promote}
              data-cy={`promote-officer-${member.game_pseudo}`}
            >
              <ShieldCheck className='mr-2 size-4' />
              {t.game.alliances.promoteOfficer}
            </DropdownMenuItem>
          )}
          {canTransferOwner && (
            <DropdownMenuItem
              onClick={() => setIsTransferDialogOpen(true)}
              className='text-yellow-500 flex items-center'
              disabled={isLoading.transfer_owner}
              data-cy={`transfer-owner-${member.game_pseudo}`}
            >
              <Crown className='mr-2 size-4' />
              {t.game.alliances.transferOwner}
            </DropdownMenuItem>
          )}
          {canDemote && (
            <DropdownMenuItem
              onClick={() => handleAction(AllianceMemberAction.DEMOTE)}
              className='text-amber-500 flex items-center'
              disabled={isLoading.demote}
              data-cy={`demote-officer-${member.game_pseudo}`}
            >
              <ShieldMinus className='mr-2 size-4' />
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
              <UserMinus className='mr-2 size-4' />
              {t.game.alliances.leaveAlliance}
            </DropdownMenuItem>
          )}
          {canExclude && (
            <DropdownMenuItem
              onClick={() => setIsExcludeDialogOpen(true)}
              className='text-destructive flex items-center'
              disabled={isLoading.remove}
              data-cy={`exclude-member-${member.game_pseudo}`}
            >
              <UserMinus className='mr-2 size-4' />
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

      <TextConfirmationDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        title={t.game.alliances.transferOwner}
        description={t.game.alliances.transferOwnerConfirm
          .replace('{pseudo}', member.game_pseudo)
          .replace('{pseudo}', member.game_pseudo)}
        onConfirm={() => handleAction(AllianceMemberAction.TRANSFER_OWNER)}
        confirmationWord={member.game_pseudo}
        inputLabel={member.game_pseudo}
        confirmText={t.game.alliances.transferOwner}
      />
    </>
  );
}
