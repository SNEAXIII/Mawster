'use client'

import { useId, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AuditSearchSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  dataCy: string
}

/** A filter select whose options are searched in the browser, by their label. */
export default function AuditSearchSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
  dataCy,
}: Readonly<AuditSearchSelectProps>) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const contentId = useId()

  const select = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={label}
          className='w-full justify-between font-normal sm:w-44'
          data-cy={dataCy}
        >
          <span className='truncate'>
            {options.find((option) => option.value === value)?.label ?? allLabel}
          </span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={contentId}
        align='start'
        className='w-96 max-w-[calc(100vw-2rem)] p-0'
      >
        <Command>
          <CommandInput
            placeholder={label}
            data-cy={`${dataCy}-search`}
          />
          <CommandList>
            <CommandEmpty>{t.common.noResults}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => select('')}
                data-cy={`${dataCy}-all`}
              >
                <span className='text-muted-foreground'>{allLabel}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => select(option.value)}
                  data-cy={`${dataCy}-${option.value}`}
                >
                  <span className='truncate'>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
