import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Calendar } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useI18n } from '@/app/i18n';
import { formatDateLong } from '@/app/lib/utils';
import { InfoRow } from './info-row';

export function AccountInfoCard({
  name,
  email,
  discordId,
  createdAt,
}: Readonly<{
  name?: string | null;
  email?: string | null;
  discordId?: string | null;
  createdAt?: string | null;
}>) {
  const { locale, t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>{t.profile.accountInfo}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
          <InfoRow
            icon={<User className='h-4 w-4' />}
            label={t.profile.username}
            value={name}
            fallback={t.common.notAvailable}
            dataCy='username-row'
          />
          <InfoRow
            icon={<Mail className='h-4 w-4' />}
            label={t.profile.email}
            value={email}
            fallback={t.common.notAvailable}
            dataCy='email-row'
          />
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
