'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader, AlertCircle } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaDiscord } from 'react-icons/fa';
import { useI18n } from '@/app/i18n';

import { IS_DEV } from '@/app/lib/dev-mode';
import { MawsterLogo } from '@/components/MawsterLogo';

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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Google login error:', error);
      setError(t.login.errorGeneric);
      setIsLoading(false);
    }
  };

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

  const renderDevUserPicker = () => {
    if (devLoading) {
      return (
        <div className='flex justify-center py-2'>
          <Loader className='w-5 h-5 animate-spin text-muted-foreground' />
        </div>
      );
    }
    if (devUsers.length === 0) {
      return <p className='text-xs text-muted-foreground text-center'>{t.login.devNoUsers}</p>;
    }
    return (
      <div
        className='max-h-60 overflow-y-auto space-y-1'
        data-cy='dev-user-list'
      >
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
            <Badge
              variant='secondary'
              className='ml-2 shrink-0 text-[10px]'
            >
              {u.role}
            </Badge>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className='min-h-full flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 sm:p-6'>
      <Card className='w-full max-w-md mx-auto shadow-lg transition-all duration-300 hover:shadow-xl'>
        <CardHeader className='space-y-1'>
          <div className='flex mx-auto'>
            <MawsterLogo />
          </div>
          <CardTitle className='text-2xl font-bold text-center'>{t.login.title}</CardTitle>
          <p className='text-sm text-center text-muted-foreground'>{t.login.subtitle}</p>
        </CardHeader>
        <CardContent className='px-4 sm:px-6 py-4'>
          <div className='space-y-4'>
            {error && (
              <Alert variant='destructive'>
                <AlertCircle size={16} />
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
                <Loader className='w-5 h-5 mr-2 animate-spin' />
              ) : (
                <>
                  <FaDiscord className='w-5 h-5 text-[#5865F2]' />
                  {t.login.discordButton}
                </>
              )}
            </Button>

            <Button
              type='button'
              variant='outline'
              className='w-full flex items-center justify-center gap-2 h-12 text-base'
              onClick={handleGoogleLogin}
              disabled={isLoading}
              data-cy='google-login-btn'
            >
              {isLoading ? (
                <Loader className='w-5 h-5 mr-2 animate-spin' />
              ) : (
                <>
                  <FcGoogle className='w-5 h-5' />
                  {t.login.googleButton}
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
                {renderDevUserPicker()}
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
