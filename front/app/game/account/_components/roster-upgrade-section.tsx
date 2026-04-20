import { useAllianceRole } from '@/hooks/use-alliance-role';
import UpgradeRequestsSection from './upgrade-requests-section';

interface RosterUpgradeSectionProps {
  selectedAccountId: string;
  allianceId: string | null;
  refreshKey: number;
}

export default function RosterUpgradeSection({
  selectedAccountId,
  allianceId,
  refreshKey,
}: Readonly<RosterUpgradeSectionProps>) {
  const { getRoleFor } = useAllianceRole();
  const role = allianceId ? getRoleFor(allianceId) : undefined;
  return (
    <UpgradeRequestsSection
      gameAccountId={selectedAccountId}
      refreshKey={refreshKey}
      canCancel={role?.can_manage ?? false}
    />
  );
}
