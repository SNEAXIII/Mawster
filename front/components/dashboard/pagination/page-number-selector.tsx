'use client';

import React from 'react';
import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu';
import { useI18n } from '@/app/i18n';

interface PageNumberSelectorProps {
  usersPerPage: number;
  onValueChange: (value: string) => void;
  defaultSize?: number;
}

export default function PageNumberSelector({
  usersPerPage,
  onValueChange,
  defaultSize = 10,
}: PageNumberSelectorProps) {
  const { t } = useI18n();

  const sizes = [5, 10, 20, 50, 100];
  const options = sizes.map((s) => ({
    value: String(s),
    label: s === defaultSize ? `${s} ${t.dashboard.pagination.default}` : String(s),
  }));

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
