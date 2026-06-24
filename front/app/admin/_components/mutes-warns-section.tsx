'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FiRefreshCw, FiVolumeX, FiAlertTriangle, FiVolume2 } from 'react-icons/fi';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  listMutes,
  listWarns,
  muteUser,
  warnUser,
  liftMute,
  type Mute,
  type Warn,
} from '@/app/services/moderation';
import UserModerationDialog, { type ModerationKind } from './user-moderation-dialog';

type Target = { userId: string; userLogin: string };

type MutesWarnsSectionProps = Readonly<{
  refreshSignal?: number;
}>;

export default function MutesWarnsSection({ refreshSignal }: MutesWarnsSectionProps) {
  const { t } = useI18n();
  const m = t.moderation;
  const [mutes, setMutes] = useState<Mute[]>([]);
  const [warns, setWarns] = useState<Warn[]>([]);
  const [dialogKind, setDialogKind] = useState<ModerationKind | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null);
  const [liftTarget, setLiftTarget] = useState<Target | null>(null);

  const load = useCallback(async () => {
    try {
      const [mu, wa] = await Promise.all([listMutes(true), listWarns()]);
      setMutes(mu);
      setWarns(wa);
    } catch (err) {
      toast.error((err as Error).message || m.loadError);
    }
  }, [m.loadError]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const openDialog = (kind: ModerationKind, target: Target) => {
    setDialogTarget(target);
    setDialogKind(kind);
  };

  const onSubmit = async (reason: string, expiresAt: string | null) => {
    if (!dialogTarget || !dialogKind) return;
    const kind = dialogKind;
    setDialogKind(null);
    try {
      if (kind === 'mute') {
        await muteUser(dialogTarget.userId, reason, expiresAt);
        toast.success(m.muteSuccess);
      } else {
        await warnUser(dialogTarget.userId, reason);
        toast.success(m.warnSuccess);
      }
      await load();
    } catch (err) {
      toast.error((err as Error).message || (kind === 'mute' ? m.muteError : m.warnError));
    }
  };

  const onLift = async () => {
    if (!liftTarget) return;
    try {
      await liftMute(liftTarget.userId);
      toast.success(m.liftSuccess);
      await load();
    } catch (err) {
      toast.error((err as Error).message || m.liftError);
    }
    setLiftTarget(null);
  };

  return (
    <div className='flex flex-col gap-3' data-cy='mutes-warns-section'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-semibold text-foreground'>{m.mutesWarnsTitle}</h3>
        <Button size='sm' variant='outline' onClick={load} data-cy='mutes-warns-refresh'>
          <FiRefreshCw className='mr-1 size-4' />
          {m.refresh}
        </Button>
      </div>

      <div className='overflow-x-auto rounded-md border border-border'>
        <table className='w-full min-w-160 table-fixed text-sm' data-cy='mutes-table'>
          <colgroup>
            <col className='w-[16%]' />
            <col className='w-[24%]' />
            <col className='w-[20%]' />
            <col className='w-[16%]' />
            <col className='w-[24%]' />
          </colgroup>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colUser}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colReason}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colExpiry}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colBy}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {mutes.length === 0 && (
              <tr>
                <td colSpan={5} className='px-3 py-6 text-center text-muted-foreground'>{m.noMutes}</td>
              </tr>
            )}
            {mutes.map((mu) => (
              <tr key={mu.id} className='border-t border-border hover:bg-muted/30' data-cy='mute-row'>
                <td className='px-3 py-2 whitespace-nowrap'>{mu.user_login}</td>
                <td className='px-3 py-2 max-w-48 truncate' title={mu.reason}>{mu.reason}</td>
                <td className='px-3 py-2 whitespace-nowrap'>
                  {mu.expires_at ? new Date(mu.expires_at).toLocaleString() : m.noExpiry}
                </td>
                <td className='px-3 py-2 whitespace-nowrap'>{mu.muted_by_login ?? '—'}</td>
                <td className='px-3 py-2'>
                  <div className='flex items-center gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      data-cy='moderation-warn'
                      onClick={() => openDialog('warn', { userId: mu.user_id, userLogin: mu.user_login })}
                    >
                      <FiAlertTriangle className='mr-1 size-4' />
                      {m.warn}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      data-cy='moderation-lift-mute'
                      onClick={() => setLiftTarget({ userId: mu.user_id, userLogin: mu.user_login })}
                    >
                      <FiVolume2 className='mr-1 size-4' />
                      {m.liftMute}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='overflow-x-auto rounded-md border border-border'>
        <table className='w-full min-w-160 table-fixed text-sm' data-cy='warns-table'>
          <colgroup>
            <col className='w-[16%]' />
            <col className='w-[24%]' />
            <col className='w-[20%]' />
            <col className='w-[16%]' />
            <col className='w-[24%]' />
          </colgroup>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colUser}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colReason}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colDate}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colBy}</th>
              <th className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{m.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {warns.length === 0 && (
              <tr>
                <td colSpan={5} className='px-3 py-6 text-center text-muted-foreground'>{m.noWarns}</td>
              </tr>
            )}
            {warns.map((wa) => (
              <tr key={wa.id} className='border-t border-border hover:bg-muted/30' data-cy='warn-row'>
                <td className='px-3 py-2 whitespace-nowrap'>{wa.user_login}</td>
                <td className='px-3 py-2 max-w-48 truncate' title={wa.reason}>{wa.reason}</td>
                <td className='px-3 py-2 whitespace-nowrap'>{new Date(wa.created_at).toLocaleString()}</td>
                <td className='px-3 py-2 whitespace-nowrap'>{wa.warned_by_login ?? '—'}</td>
                <td className='px-3 py-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    data-cy='moderation-mute'
                    onClick={() => openDialog('mute', { userId: wa.user_id, userLogin: wa.user_login })}
                  >
                    <FiVolumeX className='mr-1 size-4' />
                    {m.mute}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserModerationDialog
        kind={dialogKind}
        userLogin={dialogTarget?.userLogin ?? null}
        onClose={() => setDialogKind(null)}
        onSubmit={onSubmit}
      />

      <ConfirmationDialog
        open={!!liftTarget}
        onOpenChange={(open) => !open && setLiftTarget(null)}
        title={m.liftMuteTitle}
        description={m.liftMuteDescription}
        confirmText={m.liftMute}
        onConfirm={onLift}
      />
    </div>
  );
}
