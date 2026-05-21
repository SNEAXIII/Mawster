'use client';

import { useEffect, useState } from 'react';
import { Eye, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/app/i18n';
import { type AllianceVisitor, getAllianceVisitors, kickVisitor, inviteMember } from '@/app/services/game';
import { ConfirmationDialog } from '@/components/confirmation-dialog';

interface AllianceVisitorsSectionProps {
  allianceId: string;
  canManage: boolean;
  onViewRoster: (gameAccountId: string, pseudo: string) => void;
  onRefresh: () => Promise<void>;
}

export default function AllianceVisitorsSection({
  allianceId,
  canManage,
  onViewRoster,
  onRefresh,
}: Readonly<AllianceVisitorsSectionProps>) {
  const { t } = useI18n();
  const [visitors, setVisitors] = useState<AllianceVisitor[]>([]);
  const [kickTarget, setKickTarget] = useState<AllianceVisitor | null>(null);

  useEffect(() => {
    if (!allianceId) return;
    getAllianceVisitors(allianceId)
      .then(setVisitors)
      .catch(() => setVisitors([]));
  }, [allianceId]);

  async function handleKickConfirm() {
    if (!kickTarget) return;
    const target = kickTarget;
    setKickTarget(null);
    await kickVisitor(allianceId, target.game_account_id);
    setVisitors((prev) => prev.filter((v) => v.id !== target.id));
    await onRefresh();
  }

  async function handleInviteAsMember(visitor: AllianceVisitor) {
    await inviteMember(allianceId, visitor.game_account_id);
    await onRefresh();
  }

  if (visitors.length === 0) return null;

  return (
    <div className='border-t pt-3 flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Eye className='size-4 text-muted-foreground' />
        <span className='text-sm font-medium text-muted-foreground'>
          {t.game.alliances.visitors} ({visitors.length}/10)
        </span>
      </div>
      <div className='flex flex-col gap-1'>
        {visitors.map((v) => (
          <div
            key={v.id}
            className='flex items-center justify-between px-3 py-2 rounded-md bg-muted/40'
            data-cy={`visitor-row-${v.game_account_id}`}
          >
            <button
              className='text-sm hover:underline text-left'
              onClick={() => onViewRoster(v.game_account_id, v.game_pseudo)}
              data-cy={`visitor-roster-${v.game_account_id}`}
            >
              {v.game_pseudo}
            </button>
            {canManage && (
              <div className='flex items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7'
                  onClick={() => handleInviteAsMember(v)}
                  data-cy={`invite-visitor-as-member-${v.game_account_id}`}
                  title={t.game.alliances.inviteAsMember}
                >
                  <UserPlus className='size-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 text-destructive hover:text-destructive'
                  onClick={() => setKickTarget(v)}
                  data-cy={`kick-visitor-${v.game_account_id}`}
                  title={t.game.alliances.kickVisitor}
                >
                  <X className='size-3.5' />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmationDialog
        open={!!kickTarget}
        onOpenChange={(open) => {
          if (!open) setKickTarget(null);
        }}
        onConfirm={handleKickConfirm}
        title={t.game.alliances.kickVisitor}
        description={t.game.alliances.kickVisitorConfirm}
        variant='destructive'
      />
    </div>
  );
}
