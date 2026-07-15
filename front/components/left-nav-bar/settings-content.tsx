'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import LanguageSwitcher from '@/components/language-switcher'
import ThemePicker from '@/components/theme-picker'
import { useI18n } from '@/app/i18n'
import { signOutAndRedirect } from '@/app/lib/sign-out'

interface SettingsContentProps {
  isAuthenticated: boolean
}

export default function SettingsContent({ isAuthenticated }: Readonly<SettingsContentProps>) {
  const { t } = useI18n()

  return (
    <div className='mt-4 space-y-4'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium'>{t.nav.language}</span>
        <LanguageSwitcher />
      </div>
      <Separator />
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium'>{t.nav.theme}</span>
        <ThemePicker />
      </div>
      {isAuthenticated && (
        <>
          <Separator />
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>{t.nav.signOut}</span>
            <Button
              type='button'
              variant='destructive'
              onClick={() => signOutAndRedirect()}
              className='px-2 hover:bg-destructive/30 hover:text-destructive'
              aria-label={t.nav.signOut}
              data-cy='modal-settings-sign-out'
            >
              <LogOut className='h-5 w-5' />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
