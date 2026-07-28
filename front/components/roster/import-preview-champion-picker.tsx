'use client'

import React, { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
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
import ChampionThumbnail from '@/components/champion-thumbnail'

type CatalogChampion = Awaited<ReturnType<typeof exportAllChampions>>[number]

interface ImportPreviewChampionPickerProps {
  index: number
  championName: string
  championImageUrl: string | null
  candidates: { name: string; score: number }[]
  onPick: (name: string) => void
}

export default function ImportPreviewChampionPicker({
  index,
  championName,
  championImageUrl,
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

  // Candidates carry only a name; resolve their portrait from the catalogue.
  const imageByName = new Map(champions.map((c) => [c.name.toLowerCase(), c.image_url]))
  const imageFor = (name: string) => imageByName.get(name.toLowerCase()) ?? null

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
          className='group flex items-center gap-1 text-sm font-semibold text-left hover:underline'
          title={championName}
          data-cy={`preview-row-champion-trigger-${index}`}
        >
          <ChampionThumbnail
            imageUrl={championImageUrl}
            className='mr-2'
            name={championName}
          />
          <span className='truncate'>{championName}</span>
          <Pencil className='h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100' />
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
                    <ChampionThumbnail
                      imageUrl={imageFor(c.name)}
                      className='mr-2'
                      name={c.name}
                    />
                    <span className='flex-1 truncate'>{c.name}</span>
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
                  <ChampionThumbnail
                    imageUrl={c.image_url}
                    className='mr-2'
                    name={c.name}
                  />
                  <span className='flex-1 truncate'>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
