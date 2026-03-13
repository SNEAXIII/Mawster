'use client';

import { Suspense } from 'react';
import AdminContent, { AdminTab } from '../_components/admin-content';

export default function ChampionsPage() {
  return (
    <Suspense>
      <AdminContent defaultTab={AdminTab.Champions} />
    </Suspense>
  );
}
