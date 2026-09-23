'use client'

import { useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/app/lib/utils'
import { ChevronsUpDown, X } from 'lucide-react'

interface SearchablePlayerFilterSelectProps {
  own: string[]
  others: string[]
  value: string
  onChange: (v: string) => void
  dataCy: string
}

export default function SearchablePlayerFilterSelect({
  own,
  others,
  value,
  onChange,
  dataCy,
}: Readonly<SearchablePlayerFilterSelectProps>) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const displayLabel = value || t.game.defense.playerFilter

  function handleSelect(player: string) {
    onChange(player)
    setOpen(false)
  }

  const renderItem = (player: string) => (
    <CommandItem
      key={player}
      value={player}
      onSelect={() => handleSelect(player)}
      data-cy={`${dataCy}-item`}
      data-cy-player={player}
    >
      <span className={player === value ? 'font-semibold' : ''}>{player}</span>
    </CommandItem>
  )

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <div className='relative h-full w-36'>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('h-full w-full justify-between text-xs', value && 'pr-9')}
            data-cy={dataCy}
          >
            <span className='truncate'>{displayLabel}</span>
            {!value && <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />}
          </Button>
        </PopoverTrigger>
        {value && (
          <button
            type='button'
            aria-label={t.common.clearSelection}
            data-cy={`${dataCy}-clear`}
            onClick={() => onChange('')}
            className='absolute top-1/2 right-4 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted'
          >
            <X className='h-3 w-3' />
          </button>
        )}
      </div>
      <PopoverContent className='w-48 p-0'>
        <Command>
          <CommandInput placeholder={t.game.defense.searchPlayer} />
          <CommandList>
            <CommandEmpty>{t.game.defense.noPlayerFound}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value='__all__'
                onSelect={() => handleSelect('')}
                data-cy={`${dataCy}-all`}
              >
                <span className='text-muted-foreground'>{t.game.defense.allFilter}</span>
              </CommandItem>
              {own.map(renderItem)}
            </CommandGroup>
            {own.length > 0 && others.length > 0 && (
              <CommandSeparator data-cy={`${dataCy}-separator`} />
            )}
            <CommandGroup>{others.map(renderItem)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
