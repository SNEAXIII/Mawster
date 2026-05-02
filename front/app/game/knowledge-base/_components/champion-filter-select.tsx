'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { getChampions, getChampionImageUrl, type Champion } from '@/app/services/champions';
import { ChevronsUpDown } from 'lucide-react';

interface ChampionFilterSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  'data-cy'?: string;
}

export default function ChampionFilterSelect({
  value,
  onChange,
  placeholder,
  'data-cy': dataCy,
}: ChampionFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      getChampions(1, 500).then((res) => {
        setChampions(res.champions);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  const selectedChampion = champions.find((c) => c.id === value);
  const displayLabel = selectedChampion ? selectedChampion.name : placeholder;

  function handleSelect(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 justify-between"
          data-cy={dataCy}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search champion..." />
          <CommandList>
            <CommandEmpty>No champion found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => handleSelect(null)}
                data-cy={dataCy ? `${dataCy}-all` : undefined}
              >
                <span className="text-muted-foreground">All</span>
              </CommandItem>
              {champions.map((champ) => (
                <CommandItem
                  key={champ.id}
                  value={champ.name}
                  onSelect={() => handleSelect(champ.id)}
                  data-cy={dataCy ? `${dataCy}-item` : undefined}
                >
                  {champ.image_url && (
                    <img
                      src={getChampionImageUrl(champ.image_url, 32) ?? ''}
                      alt={champ.name}
                      className="w-8 h-8 object-contain mr-2"
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
  );
}
