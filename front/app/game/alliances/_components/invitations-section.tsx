'use client';

import { type AllianceInvitation } from '@/app/services/game';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import { Mail, Check, X } from 'lucide-react';

interface InvitationsSectionProps {
  invitations: AllianceInvitation[];
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

export default function InvitationsSection({
  invitations,
  onAccept,
  onDecline,
}: Readonly<InvitationsSectionProps>) {
  const { t } = useI18n();

  return (
    <Card data-cy='my-invitations-section'>
      <CardContent className='py-3 sm:py-4 px-3 sm:px-6 space-y-3'>
        <div className='flex items-center gap-2'>
          <Mail className='h-5 w-5 text-blue-500' />
          <h2 className='text-sm font-medium text-muted-foreground'>
            {t.game.alliances.myInvitations} ({invitations.length})
          </h2>
        </div>
        <div className='space-y-2'>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              data-cy={`my-invitation-${inv.alliance_name}`}
              className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-accent/50 border border-border'
            >
              <div className='space-y-0.5'>
                <p className='text-sm font-medium text-foreground'>
                  {inv.alliance_name}{' '}
                  <span className='text-xs text-purple-700 font-bold'>[{inv.alliance_tag}]</span>
                </p>
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
                  <Check className='h-3 w-3 mr-1' />
                  {t.game.alliances.acceptInvitation}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  data-cy='decline-invitation'
                  onClick={() => onDecline(inv.id)}
                >
                  <X className='h-3 w-3 mr-1' />
                  {t.game.alliances.declineInvitation}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
