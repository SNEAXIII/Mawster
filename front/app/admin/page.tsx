'use client';

import { Suspense } from 'react';
import AdminContent from './_components/admin-content';

export default function AdminPage() {
  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  );
}
