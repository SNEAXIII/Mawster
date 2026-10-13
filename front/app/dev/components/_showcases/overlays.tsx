'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { Section, Variant } from '../_components/showcase-section'

export default function OverlaysShowcase() {
  const [confirmOpen, setConfirmOpen] = useState<'default' | 'destructive' | null>(null)

  return (
    <>
      <p className='text-xs text-muted-foreground'>
        Overlays render in a portal: in compare mode they follow the toolbar look, not the column.
      </p>

      <Section title='Dialogs'>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='outline'>Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a defender</DialogTitle>
              <DialogDescription>Node 37 · Battlegroup 2</DialogDescription>
            </DialogHeader>
            <p className='text-sm'>Pick a champion from the member roster.</p>
          </DialogContent>
        </Dialog>
        {(['default', 'destructive'] as const).map((variant) => (
          <Variant
            key={variant}
            label={`ConfirmationDialog ${variant}`}
          >
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'secondary'}
              onClick={() => setConfirmOpen(variant)}
            >
              Confirm…
            </Button>
          </Variant>
        ))}
        <ConfirmationDialog
          open={confirmOpen !== null}
          onOpenChange={(open) => !open && setConfirmOpen(null)}
          title='Leave the alliance?'
          description='Your defense placements will be removed.'
          variant={confirmOpen ?? 'default'}
          onConfirm={() => setConfirmOpen(null)}
        />
      </Section>

      <Section title='Popover / Tooltip / DropdownMenu'>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline'>Popover</Button>
          </PopoverTrigger>
          <PopoverContent className='text-sm'>Synergies: +155% attack, +10% crit.</PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='outline'>Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Preferred attacker</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'>Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Member</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Promote to officer</DropdownMenuItem>
            <DropdownMenuItem>View roster</DropdownMenuItem>
            <DropdownMenuItem className='text-destructive'>Kick</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>
    </>
  )
}
