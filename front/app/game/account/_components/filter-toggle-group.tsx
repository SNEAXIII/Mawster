'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/app/lib/utils';

interface FilterToggleGroupProps<T extends string | number> {
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  labelFor: (o: T) => string;
  cyPrefix: string;
}

export default function FilterToggleGroup<T extends string | number>({
  options,
  selected,
  onChange,
  labelFor,
  cyPrefix,
}: Readonly<FilterToggleGroupProps<T>>) {
  const toggle = (o: T) => {
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  };

  return (
    <div className='flex flex-wrap gap-1'>
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <Button
            key={String(o)}
            type='button'
            variant='outline'
            size='sm'
            data-cy={`${cyPrefix}-${o}`}
            className={cn('h-8 text-xs', active && 'bg-primary/10 border-primary text-primary')}
            onClick={() => toggle(o)}
          >
            {labelFor(o)}
          </Button>
        );
      })}
    </div>
  );
}
