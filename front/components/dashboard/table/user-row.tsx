import { TableRow } from '@/components/ui/table';
import { User } from '@/app/services/users';
import {
  RowUserCreatedAt,
  RowUserEmail,
  RowUserLastLoginDate,
  RowUserLogin,
  RowUserRole,
  UserStatusBadge,
} from '@/components/dashboard/table/user-cells';
import { UserActions } from '@/components/dashboard/actions/user-actions';

interface UserRowProps {
  readonly user: Readonly<User>;
  readonly loadUsers: () => void;
  readonly currentUserRole?: string;
}

export function UserRow({ user, loadUsers, currentUserRole }: UserRowProps) {
  return (
    <TableRow>
      <RowUserLogin login={user.login} />
      <RowUserEmail email={user.email} />
      <RowUserRole role={user.role} />
      <RowUserCreatedAt created_at={user.created_at} />
      <RowUserLastLoginDate lastLoginDate={user.last_login_date} />
      {/* TODO FIX THIS ESLINT ERROR */}
      <UserStatusBadge
        deleted_at={!!user.deleted_at}
        disabled_at={!!user.disabled_at}
      />
      <UserActions
        userId={user.id}
        isAdmin={user.role === 'admin' || user.role === 'super_admin'}
        isSuperAdmin={currentUserRole === 'super_admin'}
        isDisabled={!!user.disabled_at}
        isDeleted={!!user.deleted_at}
        loadUsers={loadUsers}
      />
    </TableRow>
  );
}
