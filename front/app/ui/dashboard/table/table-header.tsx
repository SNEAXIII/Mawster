'use client';

import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DropdownRadioMenu from '@/app/ui/dashboard/pagination/dropdown-radio-menu';
import React from 'react';
import { useI18n } from '@/app/i18n';

export const possibleStatus = [
  { value: 'all', label: 'all' },
  { value: 'enabled', label: 'enabled' },
  { value: 'disabled', label: 'disabled' },
  { value: 'deleted', label: 'deleted' },
];
export const possibleRoles = [
  { value: 'all', label: 'all' },
  { value: 'user', label: 'user' },
  { value: 'admin', label: 'admin' },
];

interface StatusSelectorProps {
  status: string;
  onStatusChange: (value: string) => void;
}

interface RoleSelectorProps {
  role: string;
  onRoleChange: (value: string) => void;
}

export type AllSelectorProps = StatusSelectorProps & RoleSelectorProps;

export default function TableHeaderUsers({
  status,
  onStatusChange,
  role,
  onRoleChange,
}: AllSelectorProps) {
  const { t } = useI18n();

  const translatedStatus = possibleStatus.map(s => ({
    value: s.value,
    label: t.dashboard.status[s.value as keyof typeof t.dashboard.status],
  }));

  const translatedRoles = possibleRoles.map(r => ({
    value: r.value,
    label: t.dashboard.roles[r.value as keyof typeof t.dashboard.roles],
  }));

  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t.dashboard.tableHeaders.login}</TableHead>
        <TableHead>{t.dashboard.tableHeaders.email}</TableHead>
        <TableHead>
          <DropdownRadioMenu
            labelButton={t.dashboard.tableHeaders.role}
            labelDescription={t.dashboard.pagination.selectRole}
            possibleValues={translatedRoles}
            selectedValue={role}
            setValue={onRoleChange}
          />
        </TableHead>
        <TableHead>{t.dashboard.tableHeaders.creation}</TableHead>
        <TableHead>{t.dashboard.tableHeaders.lastLogin}</TableHead>
        <TableHead>
          <DropdownRadioMenu
            labelButton={t.dashboard.tableHeaders.status}
            labelDescription={t.dashboard.pagination.usersPerPage}
            possibleValues={translatedStatus}
            selectedValue={status}
            setValue={onStatusChange}
          />
        </TableHead>
        <TableHead className='w-[50px]'></TableHead>
      </TableRow>
    </TableHeader>
  );
}
