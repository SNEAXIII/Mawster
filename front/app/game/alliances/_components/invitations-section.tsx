'use client'

import { type AllianceInvitation } from '@/app/services/game'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import { Mail, Check, X, Eye, Users } from 'lucide-react'

interface InvitationsSectionProps {
  invitations: AllianceInvitation[]
  onAccept: (id: string) => Promise<void>
  onDecline: (id: string) => Promise<void>
}

export default function InvitationsSection({
  invitations,
  onAccept,
  onDecline,
}: Readonly<InvitationsSectionProps>) {
  const { t } = useI18n()

  return (
    <Card data-cy='my-invitations-section'>
      <CardContent className='py-3 sm:py-4 px-3 sm:px-6 flex flex-col gap-3'>
        <div className='flex items-center gap-2'>
          <Mail className='size-5 text-primary' />
          <h2 className='text-sm font-medium text-muted-foreground'>
            {t.game.alliances.myInvitations} ({invitations.length})
          </h2>
        </div>
        <div className='flex flex-col gap-2'>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              data-cy={`my-invitation-${inv.alliance_name}`}
              className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-accent/50 border border-border'
            >
              <div className='flex flex-col gap-0.5'>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-medium text-foreground'>
                    {inv.alliance_name}
                    <span className='text-xs text-purple-700 font-bold'>[{inv.alliance_tag}]</span>
                  </p>
                  {inv.type === 'visitor' ? (
                    <span
                      className='flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full'
                      data-cy={`visitor-badge-${inv.id}`}
                    >
                      <Eye className='size-3' />
                      {t.game.alliances.visitorBadge}
                    </span>
                  ) : (
                    <span
                      className='flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full'
                      data-cy={`member-badge-${inv.id}`}
                    >
                      <Users className='size-3' />
                      {t.game.alliances.memberBadge}
                    </span>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {t.game.alliances.invitedBy} {inv.invited_by_pseudo} · {inv.game_account_pseudo}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='default'
                  data-cy='accept-invitation'
                  onClick={() => onAccept(inv.id)}
                >
                  <Check className='size-3 mr-1' />
                  {t.game.alliances.acceptInvitation}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  data-cy='decline-invitation'
                  onClick={() => onDecline(inv.id)}
                >
                  <X className='size-3 mr-1' />
                  {t.game.alliances.declineInvitation}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
