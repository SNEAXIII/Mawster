import { useEffect } from 'react'
import { useAllianceRole } from '@/hooks/use-alliance-role'
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests'
import UpgradeRequestDialogs from '@/components/upgrade-request-dialogs'
import UpgradeRequestsSection from './upgrade-requests-section'

interface RosterUpgradeSectionProps {
  selectedAccountId: string
  allianceId: string | null
  refreshKey: number
}

export default function RosterUpgradeSection({
  selectedAccountId,
  allianceId,
  refreshKey,
}: Readonly<RosterUpgradeSectionProps>) {
  const { getRoleFor } = useAllianceRole()
  const role = allianceId ? getRoleFor(allianceId) : undefined
  const upgrade = useUpgradeRequests()
  const { fetchUpgradeRequests, setUpgradeRequests } = upgrade

  useEffect(() => {
    if (selectedAccountId) void fetchUpgradeRequests(selectedAccountId)
    else setUpgradeRequests([])
  }, [selectedAccountId, refreshKey, fetchUpgradeRequests, setUpgradeRequests])

  return (
    <>
      <UpgradeRequestsSection
        gameAccountId={selectedAccountId}
        requests={upgrade.upgradeRequests}
        canCancel={role?.can_manage ?? false}
        onInitiateCancel={upgrade.initiateCancelRequest}
      />
      <UpgradeRequestDialogs upgrade={upgrade} />
    </>
  )
}
