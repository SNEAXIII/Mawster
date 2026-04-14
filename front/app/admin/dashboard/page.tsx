'use client';

import { Suspense } from 'react';
import AdminContent from '../_components/admin-content';
import { AdminTab } from '../_viewmodels/use-admin-viewmodel';

export default function DashboardPage() {
  return (
    <Suspense>
      <AdminContent defaultTab={AdminTab.Users} />
    </Suspense>
  );
}
