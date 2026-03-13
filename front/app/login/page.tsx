'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader, AlertCircle, User } from 'lucide-react';
import { useI18n } from '@/app/i18n';

const IS_DEV = process.env.NODE_ENV === 'development';

interface DevUser {
  id: string;
  login: string;
  email: string;
  role: string;
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const { t } = useI18n();

  // In dev mode, fetch the user list from the backend
  useEffect(() => {
    if (!IS_DEV) return;
    setDevLoading(true);
    fetch('/api/dev/users')
      .then((res) => (res.ok ? res.json() : []))
      .then((users: DevUser[]) => setDevUsers(users))
      .catch(() => setDevUsers([]))
      .finally(() => setDevLoading(false));
  }, []);

  const handleDiscordLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('discord', { callbackUrl });
    } catch (error) {
      console.error('Login error:', error);
      setError(t.login.errorGeneric);
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('dev-login', { user_id: userId, callbackUrl });
    } catch (error) {
      console.error('Dev login error:', error);
      setError(t.login.errorGeneric);
      setIsLoading(false);
    }
  };

  return (
    <div className='h-full flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 sm:p-6'>
      <Card className='w-full max-w-md mx-auto shadow-lg transition-all duration-300 hover:shadow-xl'>
        <CardHeader className='space-y-1'>
          <div className='flex justify-center mb-2'>
            <div className='w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center'>
              <User className='w-8 h-8 text-primary' />
            </div>
          </div>
          <CardTitle className='text-2xl font-bold text-center'>{t.login.title}</CardTitle>
          <p className='text-sm text-center text-muted-foreground'>
            {t.login.subtitle}
          </p>
        </CardHeader>
        <CardContent className='px-4 sm:px-6 py-4'>
          <div className='space-y-4'>
            {error && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertTitle>{t.common.error}</AlertTitle>
                <AlertDescription className='mt-1'>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type='button'
              className='w-full flex items-center justify-center gap-2 h-12 text-base'
              onClick={handleDiscordLogin}
              disabled={isLoading}
              data-cy='discord-login-btn'
            >
              {isLoading ? (
                <>
                  <Loader className='w-5 h-5 mr-2 animate-spin' />
                  {t.login.signingIn}
                </>
              ) : (
                <>
                  <svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
                    <path d='M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z' />
                  </svg>
                  {t.login.discordButton}
                </>
              )}
            </Button>

            {/* ─── Dev-only: user picker ─── */}
            {IS_DEV && (
              <div className='pt-4 mt-4'>
                <Separator className='mb-4' />
                <p className='text-xs font-semibold text-orange-600 mb-2 text-center'>
                  🔓 {t.login.devModeTitle}
                </p>
                {devLoading ? (
                  <div className='flex justify-center py-2'>
                    <Loader className='w-5 h-5 animate-spin text-muted-foreground' />
                  </div>
                ) : devUsers.length === 0 ? (
                  <p className='text-xs text-muted-foreground text-center'>{t.login.devNoUsers}</p>
                ) : (
                  <ScrollArea className='max-h-60'>
                    <div className='space-y-1'>
                      {devUsers.map((u) => (
                        <button
                          key={u.id}
                          type='button'
                          className='w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors flex items-center justify-between disabled:opacity-50'
                          disabled={isLoading}
                          onClick={() => handleDevLogin(u.id)}
                          data-cy={`dev-login-${u.login}`}
                        >
                          <span className='font-medium truncate'>{u.login}</span>
                          <Badge variant='secondary' className='ml-2 shrink-0 text-[10px]'>{u.role}</Badge>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
