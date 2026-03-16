'use client';

import { Suspense } from 'react';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import WarContent from './_components/war-content';

export default function WarPage() {
  return (
    <Suspense>
      <AllianceRoleProvider>
        <WarContent />
      </AllianceRoleProvider>
    </Suspense>
  );
}
