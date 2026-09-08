'use client'

import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import SettingsContent from './settings-content'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'

interface ModalSettingsProps {
  isAuthenticated: boolean
}

export default function ModalSettings({ isAuthenticated }: Readonly<ModalSettingsProps>) {
  const { t } = useI18n()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-cy='modal-settings-trigger'
          variant='ghost'
          className={cn(
            'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-md p-2 md:h-12 md:min-w-12 md:p-3',
            // Signed in, the gear is alone on its row and can span the sidenav.
            isAuthenticated && 'md:w-full'
          )}
          aria-label={t.nav.settings}
        >
          <Settings className='size-4 md:size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent data-cy='modal-settings-content'>
        <DialogHeader>
          <DialogTitle>{t.nav.settings}</DialogTitle>
        </DialogHeader>
        <SettingsContent isAuthenticated={isAuthenticated} />
      </DialogContent>
    </Dialog>
  )
}
