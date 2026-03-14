'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '@/app/i18n';

export default function ThemePicker() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted)
    return (
      <Button
        variant='ghost'
        size='sm'
        className='px-2'
        disabled
        aria-hidden
      />
    );

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className='px-2'
      aria-label={t.nav.toggleTheme}
    >
      {isDark ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
    </Button>
  );
}
