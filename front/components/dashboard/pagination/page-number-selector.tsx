'use client';

import React from 'react';
import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu';
import { useI18n } from '@/app/i18n';

interface PageNumberSelectorProps {
  usersPerPage: number;
  onValueChange: (value: string) => void;
}

export default function PageNumberSelector({
  usersPerPage,
  onValueChange,
}: PageNumberSelectorProps) {
  const { t } = useI18n();

  const options = [
    { value: '5', label: '5' },
    { value: '10', label: `10 ${t.dashboard.pagination.default}` },
    { value: '20', label: '20' },
    { value: '50', label: '50' },
  ];

  return (
    <DropdownRadioMenu
      labelButton={`${usersPerPage} ${t.dashboard.pagination.perPage.replace('{count}', '')}`}
      labelDescription={t.dashboard.pagination.usersPerPage}
      possibleValues={options}
      selectedValue={String(usersPerPage)}
      setValue={onValueChange}
    />
  );
}
