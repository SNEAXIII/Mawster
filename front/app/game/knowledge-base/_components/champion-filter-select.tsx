'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/app/lib/utils'
import { getChampionImageUrl } from '@/app/services/champions'
import { useChampionCatalog } from '@/hooks/use-champion-catalog'
import { useI18n } from '@/app/i18n'
import { ChevronsUpDown, X } from 'lucide-react'

interface ChampionFilterSelectProps {
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  'data-cy'?: string
}

export default function ChampionFilterSelect({
  value,
  onChange,
  placeholder,
  'data-cy': dataCy,
}: Readonly<ChampionFilterSelectProps>) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const { champions } = useChampionCatalog(open)

  const selectedChampion = champions.find((c) => c.id === value)
  const displayLabel = selectedChampion ? selectedChampion.name : placeholder

  function handleSelect(id: string | null) {
    onChange(id)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <div className='relative w-48'>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('w-full justify-between', value && 'pr-9')}
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
            data-cy={dataCy ? `${dataCy}-clear` : undefined}
            onClick={() => onChange(null)}
            className='absolute top-1/2 right-4 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted'
          >
            <X className='h-3 w-3' />
          </button>
        )}
      </div>
      <PopoverContent className='w-64 p-0'>
        <Command>
          <CommandInput placeholder={t.game.knowledgeBase.searchChampion} />
          <CommandList>
            <CommandEmpty>{t.game.knowledgeBase.noChampionFound}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value='__all__'
                onSelect={() => handleSelect(null)}
                data-cy={dataCy ? `${dataCy}-all` : undefined}
              >
                <span className='text-muted-foreground'>{t.game.knowledgeBase.allChampions}</span>
              </CommandItem>
              {champions.map((champ) => (
                <CommandItem
                  key={champ.id}
                  value={champ.name}
                  onSelect={() => handleSelect(champ.id)}
                  data-cy={dataCy ? `${dataCy}-item` : undefined}
                  data-cy-champion={champ.name}
                >
                  {champ.image_url && (
                    <img
                      src={getChampionImageUrl(champ.image_url, 32) ?? ''}
                      alt={champ.name}
                      className='w-8 h-8 object-contain mr-2'
                    />
                  )}
                  <span className={champ.id === value ? 'font-semibold' : ''}>{champ.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
