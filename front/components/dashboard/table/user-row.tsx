import { TableRow } from '@/components/ui/table'
import type { User } from '@/app/services/users'
import type { UserAction } from '@/app/admin/_viewmodels/use-users-viewmodel'
import {
  RowUserCreatedAt,
  RowUserLastLoginDate,
  RowUserLogin,
  RowUserRole,
  UserStatusBadge,
} from '@/components/dashboard/table/user-cells'
import { UserActions } from '@/components/dashboard/actions/user-actions'

interface UserRowProps {
  readonly user: Readonly<User>
  readonly onUserAction: (action: UserAction, userId: string) => Promise<void>
  readonly currentUserRole?: string
}

export function UserRow({ user, onUserAction, currentUserRole }: UserRowProps) {
  return (
    <TableRow data-cy={`user-row-${user.login}`}>
      <RowUserLogin login={user.login} />
      <RowUserRole
        role={user.role}
        login={user.login}
      />
      <RowUserCreatedAt created_at={user.created_at} />
      <RowUserLastLoginDate lastLoginDate={user.last_login_date} />
      <UserStatusBadge
        deleted_at={!!user.deleted_at}
        disabled_at={!!user.disabled_at}
      />
      <UserActions
        userId={user.id}
        login={user.login}
        isAdmin={user.role === 'admin'}
        isTargetSuperAdmin={user.role === 'super_admin'}
        isSuperAdmin={currentUserRole === 'super_admin'}
        isDisabled={!!user.disabled_at}
        isDeleted={!!user.deleted_at}
        onUserAction={onUserAction}
      />
    </TableRow>
  )
}
