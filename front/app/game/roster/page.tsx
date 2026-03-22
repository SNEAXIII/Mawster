import { Suspense } from 'react';
import RosterContent from './_components/roster-content';

export default function RosterPage() {
  return (
    <Suspense>
      <RosterContent />
    </Suspense>
  );
}
