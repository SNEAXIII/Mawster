'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Calendar } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { useI18n } from '@/app/i18n';
import { formatDateLong } from '@/app/lib/utils';
import { InfoRow } from './info-row';
import { updateLogin } from '@/app/services/users';

const LOGIN_REGEX = /^[a-zA-Z0-9]{3,30}$/;

const iconBtn =
  'inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-50 cursor-pointer';

export function AccountInfoCard({
  name,
  discordId,
  createdAt,
}: Readonly<{
  name?: string | null;
  discordId?: string | null;
  createdAt?: string | null;
}>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? '');
  const [displayName, setDisplayName] = useState(name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEdit = () => {
    setValue(displayName);
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!LOGIN_REGEX.test(value)) {
      setError(t.profile.editUsernameInvalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateLogin(value);
      setDisplayName(value);
      setEditing(false);
      router.refresh();
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(e.status === 409 ? t.profile.editUsernameTaken : t.profile.editUsernameError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>{t.profile.accountInfo}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
          <div className='flex flex-col gap-1' data-cy='username-row'>
            <div className='flex items-center gap-2'>
              <User className='h-4 w-4 text-muted-foreground' />
              <span className='text-xs text-muted-foreground'>{t.profile.username}</span>
            </div>
            {editing ? (
              <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                  <input
                    className='flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t.profile.editUsernamePlaceholder}
                    disabled={loading}
                    autoFocus
                    data-cy='edit-username-input'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') handleCancel();
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`${iconBtn} text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950`}
                    data-cy='edit-username-confirm'
                  >
                    <FiCheck className='h-4 w-4' />
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className={`${iconBtn} text-muted-foreground hover:text-foreground hover:bg-muted`}
                    data-cy='edit-username-cancel'
                  >
                    <FiX className='h-4 w-4' />
                  </button>
                </div>
                {error && <p className='text-xs text-destructive'>{error}</p>}
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium' data-cy='username-value'>
                  {displayName || t.common.notAvailable}
                </span>
                <button
                  onClick={handleEdit}
                  className={`${iconBtn} text-muted-foreground hover:text-foreground hover:bg-muted`}
                  title={t.profile.editUsernameTooltip}
                  data-cy='edit-username-btn'
                >
                  <FiEdit2 className='h-3 w-3' />
                </button>
              </div>
            )}
          </div>

          <InfoRow
            icon={<FaDiscord className='h-4 w-4' />}
            label={t.profile.discordId}
            value={discordId}
            fallback={t.common.notAvailable}
            dataCy='discord-id-row'
          />
          <InfoRow
            icon={<Calendar className='h-4 w-4' />}
            label={t.profile.memberSince}
            value={createdAt ? formatDateLong(createdAt, locale) : t.common.notAvailable}
            fallback={t.common.notAvailable}
            dataCy='member-since-row'
          />
        </div>
      </CardContent>
    </Card>
  );
}
