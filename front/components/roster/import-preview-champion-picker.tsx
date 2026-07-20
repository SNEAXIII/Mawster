'use client'

import React, { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { exportAllChampions } from '@/app/services/champions'

type CatalogChampion = Awaited<ReturnType<typeof exportAllChampions>>[number]

interface ImportPreviewChampionPickerProps {
  index: number
  championName: string
  candidates: { name: string; score: number }[]
  onPick: (name: string) => void
}

export default function ImportPreviewChampionPicker({
  index,
  championName,
  candidates,
  onPick,
}: ImportPreviewChampionPickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [champions, setChampions] = useState<CatalogChampion[]>([])

  // Loaded on first open only: the catalogue is large and most rows are never
  // corrected, so paying for it upfront on 48 rows would be waste.
  useEffect(() => {
    if (!open || champions.length > 0) return
    void exportAllChampions()
      .then(setChampions)
      .catch(() => setChampions([]))
  }, [open, champions.length])

  // Drop top-1: it is the current value, not an alternative.
  const runnersUp = candidates.slice(1)

  const pick = (name: string) => {
    onPick(name)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <button
          type='button'
          className='text-sm font-semibold truncate text-left hover:underline'
          title={championName}
          data-cy={`preview-row-champion-trigger-${index}`}
        >
          {championName}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-64 p-0'
        data-cy={`preview-row-champion-popover-${index}`}
      >
        <Command>
          <CommandInput placeholder={t.roster.importExport.vision.pickChampionSearch} />
          <CommandList>
            <CommandEmpty>{t.roster.importExport.vision.pickChampionEmpty}</CommandEmpty>
            {runnersUp.length > 0 && (
              <CommandGroup heading={t.roster.importExport.vision.pickChampionTitle}>
                {runnersUp.map((c) => (
                  <CommandItem
                    key={`candidate-${c.name}`}
                    value={c.name}
                    onSelect={() => pick(c.name)}
                    data-cy={`preview-row-candidate-${index}-${c.name}`}
                  >
                    <span className='flex-1 truncate'>{c.name}</span>
                    <span className='text-xs text-muted-foreground'>{c.score.toFixed(4)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup>
              {champions.map((c) => (
                <CommandItem
                  key={`catalog-${c.name}`}
                  value={c.name}
                  onSelect={() => pick(c.name)}
                  data-cy={`preview-row-catalog-${index}-${c.name}`}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
