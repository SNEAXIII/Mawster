'use client';

import { Suspense } from 'react';
import AdminContent, { AdminTab } from '../_components/admin-content';

export default function DashboardPage() {
  return (
    <Suspense>
      <AdminContent defaultTab={AdminTab.Users} />
    </Suspense>
  );
}
