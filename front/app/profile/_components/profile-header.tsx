import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useI18n } from '@/app/i18n';

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileHeader({
  name,
  role,
}: Readonly<{
  name?: string | null;
  role?: string | null;
}>) {
  const { t } = useI18n();

  return (
    <Card>
      <CardContent className='pt-6'>
        <div className='flex flex-col sm:flex-row items-center gap-4 sm:gap-6'>
          <Avatar className='h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-offset-2 ring-primary/20'>
            <AvatarFallback className='text-xl sm:text-2xl font-bold bg-primary/10 text-primary'>
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className='text-center sm:text-left space-y-1.5'>
            <h1 className='text-xl sm:text-2xl font-bold'>{name ?? t.profile.user}</h1>
            <Badge
              variant='secondary'
              className='gap-1'
            >
              <Shield className='h-3 w-3' />
              {role?.toLowerCase() ?? t.profile.user.toLowerCase()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
