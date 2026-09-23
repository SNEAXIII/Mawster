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
import { SidebarMenuButton } from '@/components/ui/sidebar'
import SettingsContent from './settings-content'
import { useI18n } from '@/app/i18n'

interface ModalSettingsProps {
  isAuthenticated: boolean
  variant: 'menu' | 'icon'
}

export default function ModalSettings({ isAuthenticated, variant }: Readonly<ModalSettingsProps>) {
  const { t } = useI18n()

  const trigger = (
    <DialogTrigger
      data-cy='modal-settings-trigger'
      aria-label={t.nav.settings}
    >
      <Settings />
      {variant === 'menu' && <span>{t.nav.settings}</span>}
    </DialogTrigger>
  )

  return (
    <Dialog>
      {/* Tooltip must wrap the trigger, not the reverse: Slot cannot forward to a Tooltip root. */}
      {variant === 'menu' ? (
        <SidebarMenuButton
          asChild
          tooltip={t.nav.settings}
        >
          {trigger}
        </SidebarMenuButton>
      ) : (
        <Button
          asChild
          variant='ghost'
          className='h-10 min-w-10 shrink-0 p-2 text-muted-foreground hover:bg-transparent hover:text-foreground'
        >
          {trigger}
        </Button>
      )}
      <DialogContent data-cy='modal-settings-content'>
        <DialogHeader>
          <DialogTitle>{t.nav.settings}</DialogTitle>
        </DialogHeader>
        <SettingsContent isAuthenticated={isAuthenticated} />
      </DialogContent>
    </Dialog>
  )
}
