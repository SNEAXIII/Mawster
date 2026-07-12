'use client';

import { useEffect, useState } from 'react';
import { type GameAccount, type AllianceInvitation } from '@/app/services/game';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/app/i18n';
import { Shield } from 'lucide-react';
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector';
import AllianceSelect from '@/app/game/_components/alliance-select';

import AllianceCard from './alliance-card';

interface AlliancesTabProps {
  alliances: AllianceWithVisitorFlag[];
  locale: string;
  memberAllianceId: string | null;
  memberAccountId: string;
  eligibleMembers: GameAccount[];
  eligibleVisitors: GameAccount[];
  pendingInvitations: Record<string, AllianceInvitation[]>;
  inviteType: 'member' | 'visitor';
  onInviteTypeChange: (type: 'member' | 'visitor') => void;
  onMemberAccountChange: (id: string) => void;
  onOpenInviteMember: (allianceId: string) => void;
  onCloseInviteMember: () => void;
  onInviteMember: (allianceId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onViewRoster: (gameAccountId: string, pseudo: string, canReq: boolean) => void;
  onCancelInvitation: (allianceId: string, invitationId: string) => Promise<void>;
}

export default function AlliancesTab({
  alliances,
  locale,
  memberAllianceId,
  memberAccountId,
  eligibleMembers,
  eligibleVisitors,
  pendingInvitations,
  inviteType,
  onInviteTypeChange,
  onMemberAccountChange,
  onOpenInviteMember,
  onCloseInviteMember,
  onInviteMember,
  onRefresh,
  onViewRoster,
  onCancelInvitation,
}: Readonly<AlliancesTabProps>) {
  const { t } = useI18n();
  const [selectedAllianceId, setSelectedAllianceId] = useState('');

  useEffect(() => {
    if (alliances.length === 0) {
      setSelectedAllianceId('');
      return;
    }
    if (!alliances.some((a) => a.id === selectedAllianceId)) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId]);

  if (alliances.length === 0) {
    return (
      <Card data-cy='alliance-empty-state'>
        <CardContent className='py-12 text-center text-muted-foreground'>
          <Shield className='size-12 mx-auto mb-3 text-muted-foreground' />
          <p className='mb-2 text-muted-foreground'>{t.game.alliances.description}</p>
          <p data-cy='alliance-empty-text'>{t.game.alliances.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId) ?? alliances[0];

  return (
    <div className='flex flex-col gap-4'>
      {alliances.length > 1 && (
        <AllianceSelect
          alliances={alliances}
          value={selectedAlliance.id}
          onChange={setSelectedAllianceId}
          dataCy='alliances-alliance-select'
        />
      )}

      <AllianceCard
        key={selectedAlliance.id}
        alliance={selectedAlliance}
        locale={locale}
        memberAllianceId={memberAllianceId}
        memberAccountId={memberAccountId}
        eligibleMembers={eligibleMembers}
        eligibleVisitors={eligibleVisitors}
        inviteType={inviteType}
        onInviteTypeChange={onInviteTypeChange}
        onMemberAccountChange={onMemberAccountChange}
        onOpenInviteMember={onOpenInviteMember}
        onCloseInviteMember={onCloseInviteMember}
        onInviteMember={onInviteMember}
        onRefresh={onRefresh}
        onViewRoster={onViewRoster}
        pendingInvitations={pendingInvitations[selectedAlliance.id] ?? []}
        onCancelInvitation={onCancelInvitation}
      />
    </div>
  );
}
