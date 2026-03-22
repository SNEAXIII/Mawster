import { Suspense } from 'react';
import AllianceContent from './_components/alliance-content';

export default function AlliancesPage() {
  return (
    <Suspense>
      <AllianceContent />
    </Suspense>
  );
}
