'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

interface DropdownRadioMenu {
  labelButton: string
  labelDescription: string
  possibleValues: Record<string, string>[]
  selectedValue: string
  setValue: (value: string) => void
  showSelected?: boolean
  'data-cy'?: string
}

export default function DropdownRadioMenu({
  labelButton,
  labelDescription,
  possibleValues,
  selectedValue,
  setValue,
  showSelected = false,
  'data-cy': dataCy,
}: Readonly<DropdownRadioMenu>) {
  const selectedLabel = possibleValues.find((v) => v.value === selectedValue)?.label
  const isFiltered = showSelected && selectedLabel && selectedLabel !== possibleValues[0]?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          className={isFiltered ? 'border-primary text-primary' : ''}
          data-cy={dataCy}
        >
          {labelButton}
          {isFiltered && <span className='ml-1 font-semibold'>: {selectedLabel}</span>}
          <ChevronDown className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56'>
        <DropdownMenuLabel>{labelDescription}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedValue}
          onValueChange={setValue}
        >
          {possibleValues.map((value) => (
            <DropdownMenuRadioItem
              key={value.value}
              value={value.value}
            >
              {value.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
