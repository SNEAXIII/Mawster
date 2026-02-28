'use client';

import { TableCell } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Power, Trash, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { disableUser, enableUser, deleteUser, promoteToAdmin } from '@/app/services/users';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useI18n } from '@/app/i18n';

const UserAction = {
  DISABLE: 'disable',
  ENABLE: 'enable',
  DELETE: 'delete',
  PROMOTE: 'promote',
} as const;

type UserAction = typeof UserAction[keyof typeof UserAction];

interface UserActionsProps {
  userId: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
  isDeleted?: boolean;
  loadUsers: () => void;
}

export const UserActions: React.FC<UserActionsProps> = ({
  userId,
  isAdmin,
  isSuperAdmin = false,
  isDisabled = false,
  isDeleted = false,
  loadUsers,
}) => {
  const initialLoadingState = {
    [UserAction.DISABLE]: false,
    [UserAction.ENABLE]: false,
    [UserAction.DELETE]: false,
    [UserAction.PROMOTE]: false,
  } as const;

  const [isLoading, setIsLoading] = useState<Record<UserAction, boolean>>(initialLoadingState);
  const { t } = useI18n();

  const handleAction = async (action: UserAction, userId: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [action]: true }));

      switch (action) {
        case UserAction.DISABLE:
          await disableUser(userId);
          setIsDisableDialogOpen(false);
          loadUsers();
          break;
        case UserAction.ENABLE:
          await enableUser(userId);
          setIsDisableDialogOpen(false);
          loadUsers();
          break;
        case UserAction.DELETE:
          await deleteUser(userId);
          setIsDeleteDialogOpen(false);
          loadUsers();
          break;
        case UserAction.PROMOTE:
          await promoteToAdmin(userId);
          setIsPromoteToAdminDialogOpen(false);
          loadUsers();
          break;
      }
    } catch (error) {
      console.error(`Error during ${action} user:`, error);
      throw error;
    } finally {
      setIsLoading(prev => ({ ...prev, [action]: false }));
    }
  };
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPromoteToAdminDialogOpen, setIsPromoteToAdminDialogOpen] = useState(false);
  const isDisabledOrAdmin = isDeleted || isAdmin;
  if (isDisabledOrAdmin) {
    return (
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant='ghost'
                  className='h-8 w-8 p-0'
                  disabled={isDisabledOrAdmin}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isAdmin && <p>{t.dashboard.actions.isAdmin}</p>}
              {isDeleted && <p>{t.dashboard.actions.isDeleted}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    );
  }

  return (
    <TableCell>
      <div className="flex flex-col space-y-2">
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='h-8 w-8 p-0'
                disabled={isDeleted}
              >
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            {!isDeleted && (
              <DropdownMenuContent align='end'>
                {isSuperAdmin && (
                <DropdownMenuItem
                  onClick={() => setIsPromoteToAdminDialogOpen(true)}
                  className='text-blue-600 flex items-center'
                  disabled={isLoading.promote}
                >
                  <UserPlus className='mr-2 h-4 w-4' />
                  {t.dashboard.actions.promote}
                </DropdownMenuItem>
                )}
                {isDisabled ? (
                  <DropdownMenuItem
                    className='text-green-600 flex items-center'
                    onClick={() => setIsDisableDialogOpen(true)}
                    disabled={isLoading.enable}
                  >
                    <Power className='mr-2 h-4 w-4' />
                    {t.dashboard.actions.enable}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className='text-orange-600 flex items-center'
                    onClick={() => setIsDisableDialogOpen(true)}
                    disabled={isLoading.disable}
                  >
                    <Power className='mr-2 h-4 w-4' />
                    {t.dashboard.actions.disable}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className='text-red-600 flex items-center'
                  disabled={isLoading.delete}
                >
                  <Trash className='mr-2 h-4 w-4' />
                  {t.dashboard.actions.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>

        {/* Dialogs */}
        {isDisabled ? (
          <ConfirmationDialog
            open={isDisableDialogOpen}
            onOpenChange={setIsDisableDialogOpen}
            title={t.dashboard.dialogs.enableUser}
            description={t.dashboard.dialogs.enableUserDesc}
            onConfirm={() => handleAction(UserAction.ENABLE, userId)}
            confirmText={t.dashboard.actions.enable}
          />
        ) : (
          <ConfirmationDialog
            open={isDisableDialogOpen}
            onOpenChange={setIsDisableDialogOpen}
            title={t.dashboard.dialogs.disableUser}
            description={t.dashboard.dialogs.disableUserDesc}
            onConfirm={() => handleAction(UserAction.DISABLE, userId)}
            confirmText={t.dashboard.actions.disable}
          />
        )}

        <ConfirmationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={t.dashboard.dialogs.deleteUser}
          description={t.dashboard.dialogs.deleteUserDesc}
          onConfirm={() => handleAction(UserAction.DELETE, userId)}
          variant='destructive'
          confirmText={t.common.delete}
        />


        <ConfirmationDialog
          open={isPromoteToAdminDialogOpen}
          onOpenChange={setIsPromoteToAdminDialogOpen}
          title={t.dashboard.dialogs.promoteUser}
          description={t.dashboard.dialogs.promoteUserDesc}
          onConfirm={() => handleAction(UserAction.PROMOTE, userId)}
          confirmText={t.dashboard.actions.promote}
        />

      </div>
    </TableCell>
  );
};
