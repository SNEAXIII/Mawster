'use client';

import { type Alliance, type GameAccount, type AllianceInvitation } from '@/app/services/game';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/app/i18n';
import { Shield } from 'lucide-react';

import AllianceCard from './alliance-card';

interface AlliancesTabProps {
  alliances: Alliance[];
  locale: string;
  memberAllianceId: string | null;
  memberAccountId: string;
  eligibleMembers: GameAccount[];
  pendingInvitations: Record<string, AllianceInvitation[]>;
  onMemberAccountChange: (id: string) => void;
  onOpenInviteMember: (allianceId: string) => void;
  onCloseInviteMember: () => void;
  onInviteMember: (allianceId: string) => Promise<void>;
  onRefresh: () => void;
  onViewRoster: (gameAccountId: string, pseudo: string, canReq: boolean) => void;
  onCancelInvitation: (allianceId: string, invitationId: string) => Promise<void>;
}

export default function AlliancesTab({
  alliances,
  locale,
  memberAllianceId,
  memberAccountId,
  eligibleMembers,
  pendingInvitations,
  onMemberAccountChange,
  onOpenInviteMember,
  onCloseInviteMember,
  onInviteMember,
  onRefresh,
  onViewRoster,
  onCancelInvitation,
}: Readonly<AlliancesTabProps>) {
  const { t } = useI18n();

  if (alliances.length === 0) {
    return (
      <Card data-cy='alliance-empty-state'>
        <CardContent className='py-12 text-center text-gray-500'>
          <Shield className='h-12 w-12 mx-auto mb-3 text-muted-foreground' />
          <p className='mb-2 text-muted-foreground'>{t.game.alliances.description}</p>
          <p data-cy='alliance-empty-text'>{t.game.alliances.empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      {alliances.map((alliance) => (
        <AllianceCard
          key={alliance.id}
          alliance={alliance}
          locale={locale}
          memberAllianceId={memberAllianceId}
          memberAccountId={memberAccountId}
          eligibleMembers={eligibleMembers}
          onMemberAccountChange={onMemberAccountChange}
          onOpenInviteMember={onOpenInviteMember}
          onCloseInviteMember={onCloseInviteMember}
          onInviteMember={onInviteMember}
          onRefresh={onRefresh}
          onViewRoster={onViewRoster}
          pendingInvitations={pendingInvitations[alliance.id] ?? []}
          onCancelInvitation={onCancelInvitation}
        />
      ))}
    </div>
  );
}
