'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AllianceRoleProvider } from '@/hooks/use-alliance-role';
import WarContent from './_components/war-content';

function WarPageInner() {
  const searchParams = useSearchParams();
  const initialAllianceId = searchParams.get('alliance') ?? undefined;
  const bgParam = searchParams.get('bg');
  const parsedBg = bgParam ? Number(bgParam) : undefined;
  const initialBg = parsedBg && [1, 2, 3].includes(parsedBg) ? parsedBg : undefined;

  return (
    <AllianceRoleProvider>
      <WarContent initialAllianceId={initialAllianceId} initialBg={initialBg} />
    </AllianceRoleProvider>
  );
}

export default function WarPage() {
  return (
    <Suspense>
      <WarPageInner />
    </Suspense>
  );
}
