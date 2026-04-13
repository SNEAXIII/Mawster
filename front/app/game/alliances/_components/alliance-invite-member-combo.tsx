'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { type GameAccount } from '@/app/services/game';

interface InviteMemberComboProps {
  eligibleMembers: GameAccount[];
  memberAccountId: string;
  onMemberAccountChange: (value: string) => void;
}

export default function InviteMemberCombo({
  eligibleMembers,
  memberAccountId,
  onMemberAccountChange,
}: Readonly<InviteMemberComboProps>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full sm:w-48 h-8 text-xs justify-between font-normal'
          data-cy='invite-member-select'
        >
          {memberAccountId
            ? eligibleMembers.find((acc) => acc.id === memberAccountId)?.game_pseudo
            : t.game.alliances.selectMember}
          <ChevronsUpDown className='ml-2 h-3 w-3 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-48 p-0'>
        <Command>
          <CommandInput
            placeholder={t.game.alliances.selectMember}
            className='h-8 text-xs'
          />
          <CommandList>
            <CommandEmpty>{t.common.noResults}</CommandEmpty>
            <CommandGroup>
              {eligibleMembers.map((acc) => (
                <CommandItem
                  key={acc.id}
                  value={acc.game_pseudo}
                  onSelect={() => {
                    onMemberAccountChange(acc.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-3 w-3 ${memberAccountId === acc.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {acc.game_pseudo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
