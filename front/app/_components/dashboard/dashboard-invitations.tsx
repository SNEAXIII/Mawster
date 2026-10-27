'use client'

import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { type AllianceInvitation, acceptInvitation, declineInvitation } from '@/app/services/game'
import InvitationsSection from '@/app/game/alliances/_components/invitations-section'

interface DashboardInvitationsProps {
  invitations: AllianceInvitation[]
  onAnswered: () => Promise<void>
}

export function DashboardInvitations({
  invitations,
  onAnswered,
}: Readonly<DashboardInvitationsProps>) {
  const { t } = useI18n()
  if (invitations.length === 0) return null

  const answer = async (
    call: (id: string) => Promise<AllianceInvitation>,
    id: string,
    success: string,
    failure: string
  ) => {
    try {
      await call(id)
      toast.success(success)
    } catch (err: unknown) {
      console.error(err)
      toast.error(failure)
    }
    void onAnswered()
  }

  const a = t.game.alliances
  return (
    <InvitationsSection
      invitations={invitations}
      onAccept={(id) =>
        answer(acceptInvitation, id, a.acceptInvitationSuccess, a.acceptInvitationError)
      }
      onDecline={(id) =>
        answer(declineInvitation, id, a.declineInvitationSuccess, a.declineInvitationError)
      }
    />
  )
}
